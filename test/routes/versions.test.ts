import { test } from "vitest";
import * as assert from "node:assert";
import { build, getAuthHeader } from "../helper.ts";
import { buildUser } from "../../src/lib/data.ts";

// phone добавлен в User только с v2 (@added в main.tsp). В v1 он появляться не
// должен: у моделей нет additionalProperties: false, поэтому схема ответа
// лишнее поле не отсечёт — удерживает его только проекция запроса. Тот же класс
// утечки, что был у password_digest.
test("phone appears in v2 and never in v1", async () => {
  const app = await build();
  const authHeader = await getAuthHeader(app);
  const user = await app.db.query.users.findFirst();
  assert.ok(user);
  assert.ok(user.phone, "сиды должны заполнять phone, иначе тест ничего не проверяет");

  const v1 = await app.inject({ url: `/users/${user.id}`, headers: { ...authHeader } });
  assert.equal(v1.statusCode, 200, v1.body);
  assert.ok(!("phone" in JSON.parse(v1.body)), `phone утёк в v1: ${v1.body}`);

  const v2 = await app.inject({ url: `/v2/users/${user.id}`, headers: { ...authHeader } });
  assert.equal(v2.statusCode, 200, v2.body);
  assert.equal(JSON.parse(v2.body).phone, user.phone);
});

test("no v1 users endpoint leaks phone", async () => {
  const app = await build();
  const authHeader = await getAuthHeader(app);
  const user = await app.db.query.users.findFirst();
  assert.ok(user);

  const responses = {
    index: await app.inject({ url: "/users", headers: { ...authHeader } }),
    show: await app.inject({ url: `/users/${user.id}`, headers: { ...authHeader } }),
    create: await app.inject({ method: "post", url: "/users", body: buildUser() }),
    update: await app.inject({
      method: "put",
      url: `/users/${user.id}`,
      headers: { ...authHeader },
      body: { fullName: "Renamed Person" },
    }),
  };

  const leaking: string[] = [];
  for (const [name, res] of Object.entries(responses)) {
    assert.ok(res.statusCode < 400, `${name} -> ${res.statusCode}: ${res.body}`);
    if (/phone/i.test(res.body)) leaking.push(`${name}: ${res.body}`);
  }
  assert.deepStrictEqual(leaking, []);
});

test("v2 accepts phone on create, v1 ignores it", async () => {
  const app = await build();

  const viaV2 = await app.inject({
    method: "post",
    url: "/v2/users",
    body: { ...buildUser(), phone: "+31 20 000 0000" },
  });
  assert.equal(viaV2.statusCode, 201, viaV2.body);
  assert.equal(JSON.parse(viaV2.body).phone, "+31 20 000 0000");

  const viaV1 = await app.inject({
    method: "post",
    url: "/users",
    body: { ...buildUser(), phone: "+31 20 111 1111" },
  });
  assert.equal(viaV1.statusCode, 201, viaV1.body);
  assert.ok(!("phone" in JSON.parse(viaV1.body)));

  // v1 не знает о поле, поэтому и записать его не должен.
  const created = await app.db.query.users.findFirst({
    where: (row, { eq }) => eq(row.id, JSON.parse(viaV1.body).id),
  });
  assert.equal(created?.phone, null);
});

test("both versions serve their own document", async () => {
  const app = await build();

  const v1 = await app.inject({ url: "/openapi.json" });
  const v2 = await app.inject({ url: "/v2/openapi.json" });
  assert.equal(v1.statusCode, 200);
  assert.equal(v2.statusCode, 200);

  const v1Doc = JSON.parse(v1.body);
  const v2Doc = JSON.parse(v2.body);
  assert.ok(!("phone" in v1Doc.components.schemas.User.properties));
  assert.ok("phone" in v2Doc.components.schemas.User.properties);

  // Без servers клиент, собранный по документу v2, стучался бы в корень, то
  // есть в v1.
  assert.deepStrictEqual(v2Doc.servers, [{ url: "/v2", description: "Версия 2" }]);
});

// Авторизация должна применяться в обеих версиях: securityHandlers передаётся в
// обе регистрации glue, и забыть одну из них легко.
test("v2 enforces authorization too", async () => {
  const app = await build();

  const res = await app.inject({ url: "/v2/users" });
  assert.equal(res.statusCode, 401, res.body);

  const authHeader = await getAuthHeader(app);
  const allowed = await app.inject({ url: "/v2/users", headers: { ...authHeader } });
  assert.equal(allowed.statusCode, 200, allowed.body);
});

test("shared resources answer under both versions", async () => {
  const app = await build();

  for (const prefix of ["", "/v2"]) {
    const res = await app.inject({ url: `${prefix}/courses` });
    assert.equal(res.statusCode, 200, `${prefix}/courses -> ${res.statusCode}`);
    assert.ok(Array.isArray(JSON.parse(res.body).data));
  }
});
