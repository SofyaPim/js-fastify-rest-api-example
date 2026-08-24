import { expect } from "vitest";
import {
  expectStatus,
  firstCourse,
  firstUser,
  getAuthHeader,
  createTest,
  userById,
} from "../helper.ts";
import { buildUser } from "#src/lib/data.ts";

const test = createTest();
const MISSING_ID = 999_999;

test("get users", async ({ app }) => {
  const authHeader = await getAuthHeader(app);

  const res = await app.inject({ url: "/v1/users", headers: { ...authHeader } });
  expectStatus(res, 200);
  expect(res.json()).toMatchObject({
    data: expect.any(Array),
    meta: { page: 1, perPage: 10, total: expect.any(Number) },
  });
});

test("get users/:id", async ({ app }) => {
  const user = await firstUser(app);
  const authHeader = await getAuthHeader(app);

  const res = await app.inject({ url: `/v1/users/${user.id}`, headers: { ...authHeader } });
  expectStatus(res, 200);
  expect(res.json()).toMatchObject({ id: user.id, email: user.email });
});

test("post users", async ({ app }) => {
  const attrs = buildUser();

  const res = await app.inject({ method: "post", url: "/v1/users", body: attrs });
  expectStatus(res, 201);
  expect(res.json()).toMatchObject({ id: expect.any(Number), email: attrs.email });
});

// Регистр не должен позволять завести дубль: правило uniqueness приводит адрес
// к нижнему регистру перед проверкой.
test("post users rejects a duplicate email whatever its case", async ({ app }) => {
  const user = await firstUser(app);

  const res = await app.inject({
    method: "post",
    url: "/v1/users",
    body: buildUser({ email: user.email.toUpperCase() }),
  });
  expectStatus(res, 422);
});

test("put users/:id", async ({ app }) => {
  const user = await firstUser(app);
  const authHeader = await getAuthHeader(app);

  const res = await app.inject({
    method: "put",
    url: `/v1/users/${user.id}`,
    headers: { ...authHeader },
    body: { fullName: "Renamed Person" },
  });
  expectStatus(res, 200);
  expect((await userById(app, user.id))?.fullName).toBe("Renamed Person");
});

test("delete users/:id", async ({ app }) => {
  const user = await firstUser(app);
  const authHeader = await getAuthHeader(app, user.id);

  const res = await app.inject({
    method: "delete",
    url: `/v1/users/${user.id}`,
    headers: { ...authHeader },
  });
  expectStatus(res, 204);
  expect(await userById(app, user.id)).toBeUndefined();
});

// Операции, у которых в main.tsp стоит @useAuth(BearerAuth). Список повторяет
// спеку намеренно: тест должен падать, если авторизацию отвяжут от неё и снова
// начнут писать jwtVerify в обработчиках руками — так уже было, и тогда все
// пять операций /users оказались открыты. v2 перечислен рядом: securityHandlers
// передаётся в обе регистрации glue, и забыть одну легко.
//
// Тела валидные: glue вешает проверку безопасности на preHandler, то есть после
// валидации запроса, и на кривом теле без токена придёт 400, а не 401.
const protectedOperations = [
  { method: "get", url: "/v1/users" },
  { method: "get", url: "/v1/users/1" },
  { method: "put", url: "/v1/users/1", body: { fullName: "Someone Else" } },
  { method: "delete", url: "/v1/users/1" },
  { method: "get", url: "/v2/users" },
  { method: "get", url: "/v2/users/1" },
  { method: "put", url: "/v2/users/1", body: { fullName: "Someone Else" } },
  { method: "delete", url: "/v2/users/1" },
] as const;

// Ответы собираются целиком и сверяются одним expect, а не падают на первом:
// иначе одна открытая операция маскирует остальные.
test("no user operation answers without a token", async ({ app }) => {
  const answered = [];
  for (const { method, url, ...rest } of protectedOperations) {
    const anonymous = await app.inject({ method, url, ...rest });
    const malformed = await app.inject({
      method,
      url,
      headers: { Authorization: "Bearer not-a-jwt" },
      ...rest,
    });
    answered.push({
      operation: `${method.toUpperCase()} ${url}`,
      anonymous: anonymous.statusCode,
      malformed: malformed.statusCode,
    });
  }

  expect(answered).toEqual(
    protectedOperations.map(({ method, url }) => ({
      operation: `${method.toUpperCase()} ${url}`,
      anonymous: 401,
      malformed: 401,
    })),
  );
});

// Регистрация — единственная операция пользователей без токена: иначе завести
// первый аккаунт было бы нечем.
test("post users needs no token", async ({ app }) => {
  const res = await app.inject({ method: "post", url: "/v1/users", body: buildUser() });
  expectStatus(res, 201);
});

// ensure() вызывал httpErrors.createError, который ошибку только создаёт, но не
// бросает. Из-за этого показ несуществующего уходил с 200 и пустым телом, а
// удаление — с 204.
test("operations on a missing user answer 404", async ({ app }) => {
  const authHeader = await getAuthHeader(app);

  const cases = [
    { method: "get", url: `/v1/users/${MISSING_ID}` },
    { method: "put", url: `/v1/users/${MISSING_ID}`, body: { fullName: "Nobody At All" } },
    { method: "delete", url: `/v1/users/${MISSING_ID}` },
    { method: "get", url: `/v2/users/${MISSING_ID}` },
    { method: "delete", url: `/v2/users/${MISSING_ID}` },
  ] as const;

  const answered = [];
  for (const { method, url, ...rest } of cases) {
    const res = await app.inject({ method, url, headers: { ...authHeader }, ...rest });
    answered.push({ operation: `${method.toUpperCase()} ${url}`, status: res.statusCode });
  }

  expect(answered).toEqual(
    cases.map(({ method, url }) => ({
      operation: `${method.toUpperCase()} ${url}`,
      status: 404,
    })),
  );
});

// В строке users лежит passwordDigest. Наружу его не пускают два слоя:
// сериализатор fastify пишет ответ строго по схеме операции, а проекция в
// db/projections.ts не выбирает поле из базы. Проверяется каждый эндпоинт,
// который отдаёт пользователя, — чтобы падало при отказе любого из двух.
test("no users endpoint leaks the password digest", async ({ app }) => {
  const authHeader = await getAuthHeader(app);
  const user = await firstUser(app);

  const created = await app.inject({ method: "post", url: "/v1/users", body: buildUser() });
  expectStatus(created, 201);

  const responses = {
    index: await app.inject({ url: "/v1/users", headers: { ...authHeader } }),
    show: await app.inject({ url: `/v1/users/${user.id}`, headers: { ...authHeader } }),
    create: created,
    update: await app.inject({
      method: "put",
      url: `/v1/users/${user.id}`,
      headers: { ...authHeader },
      body: { fullName: "Renamed Person" },
    }),
  };

  const leaking = Object.entries(responses)
    .filter(([, res]) => /password/i.test(res.body))
    .map(([name, res]) => `${name}: ${res.body}`);
  expect(leaking).toEqual([]);
});

test("a created user can authenticate with the password they set", async ({ app }) => {
  const attrs = buildUser();

  const created = await app.inject({ method: "post", url: "/v1/users", body: attrs });
  expectStatus(created, 201);

  const token = await app.inject({
    method: "post",
    url: "/v1/tokens",
    body: { email: attrs.email, password: attrs.password },
  });
  expectStatus(token, 201);
});

test("changing the password invalidates the old one", async ({ app }) => {
  const attrs = buildUser();

  const created = await app.inject({ method: "post", url: "/v1/users", body: attrs });
  expectStatus(created, 201);
  const { id } = created.json();

  const authHeader = await getAuthHeader(app, id);
  const updated = await app.inject({
    method: "put",
    url: `/v1/users/${id}`,
    headers: { ...authHeader },
    body: { password: "a-brand-new-password" },
  });
  expectStatus(updated, 200);

  const withOld = await app.inject({
    method: "post",
    url: "/v1/tokens",
    body: { email: attrs.email, password: attrs.password },
  });
  expectStatus(withOld, 401);

  const withNew = await app.inject({
    method: "post",
    url: "/v1/tokens",
    body: { email: attrs.email, password: "a-brand-new-password" },
  });
  expectStatus(withNew, 201);
});

// Пустое тело нашёл schemathesis: drizzle на пустом set бросает «No values to
// set», и правка падала в 500.
test("an empty update body leaves the record as it was", async ({ app }) => {
  const user = await firstUser(app);
  const authHeader = await getAuthHeader(app);

  const res = await app.inject({
    method: "put",
    url: `/v1/users/${user.id}`,
    headers: { ...authHeader },
    body: {},
  });

  expectStatus(res, 200);
  expect(res.json().fullName).toBe(user.fullName);
});

// Раньше это делал ON DELETE CASCADE из миграции: удаление автора молча сносило
// его курсы вместе с уроками. Курс не перестаёт существовать от того, что автор
// ушёл, поэтому удаление отклоняется.
test("deleting a user who still owns courses is rejected", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "delete",
    url: `/v1/users/${course.creatorId}`,
    headers: { ...authHeader },
  });
  expectStatus(res, 409);
  expect(await userById(app, course.creatorId)).toBeDefined();
});

// UserCreateDTO принимал имя, которое модель ответа потом браковала, и создание
// падало в 500 уже после записи в базу. Границы запроса и ответа обязаны
// совпадать — тест сторожит именно это.
test("a full name shorter than the response model allows is rejected", async ({ app }) => {
  const res = await app.inject({
    method: "post",
    url: "/v1/users",
    body: { email: "shortname@hexlet.io", fullName: "A", password: "12345678" },
  });
  expectStatus(res, 400);
});

// phone добавлен в User только с v2 (@added в main.tsp). В v1 он появляться не
// должен, и держат это два независимых слоя: сериализатор fastify пишет ответ
// строго по схеме операции, а проекция не выбирает поле из базы. Тест проверяет
// результат, а не механизм — сломаться должно, если отвалится любой из двух.
test("phone appears in v2 and never in v1", async ({ app }) => {
  const authHeader = await getAuthHeader(app);
  const user = await firstUser(app);
  expect(user.phone).toEqual(expect.any(String));

  const v1 = await app.inject({ url: `/v1/users/${user.id}`, headers: { ...authHeader } });
  expectStatus(v1, 200);
  expect(v1.json()).not.toHaveProperty("phone");

  const v2 = await app.inject({ url: `/v2/users/${user.id}`, headers: { ...authHeader } });
  expectStatus(v2, 200);
  expect(v2.json().phone).toBe(user.phone);
});

test("no v1 users endpoint leaks phone", async ({ app }) => {
  const authHeader = await getAuthHeader(app);
  const user = await firstUser(app);

  const responses = {
    index: await app.inject({ url: "/v1/users", headers: { ...authHeader } }),
    show: await app.inject({ url: `/v1/users/${user.id}`, headers: { ...authHeader } }),
    create: await app.inject({ method: "post", url: "/v1/users", body: buildUser() }),
    update: await app.inject({
      method: "put",
      url: `/v1/users/${user.id}`,
      headers: { ...authHeader },
      body: { fullName: "Renamed Person" },
    }),
  };

  const leaking = Object.entries(responses)
    .filter(([, res]) => /phone/i.test(res.body))
    .map(([name, res]) => `${name}: ${res.body}`);
  expect(leaking).toEqual([]);
});

test("v2 accepts phone on create, v1 ignores it", async ({ app }) => {
  const viaV2 = await app.inject({
    method: "post",
    url: "/v2/users",
    body: { ...buildUser(), phone: "+31 20 000 0000" },
  });
  expectStatus(viaV2, 201);
  expect(viaV2.json().phone).toBe("+31 20 000 0000");

  const viaV1 = await app.inject({
    method: "post",
    url: "/v1/users",
    body: { ...buildUser(), phone: "+31 20 111 1111" },
  });
  expectStatus(viaV1, 201);
  const created = viaV1.json();
  expect(created).not.toHaveProperty("phone");

  // v1 не знает о поле, поэтому и записать его не должен.
  expect((await userById(app, created.id))?.phone).toBeNull();
});

test("v2 update accepts phone and returns it", async ({ app }) => {
  const user = await firstUser(app);
  const authHeader = await getAuthHeader(app);

  const res = await app.inject({
    method: "put",
    url: `/v2/users/${user.id}`,
    headers: { ...authHeader },
    body: { fullName: "Renamed In V2", phone: "+31 20 222 2222" },
  });
  expectStatus(res, 200);
  expect(res.json()).toMatchObject({ fullName: "Renamed In V2", phone: "+31 20 222 2222" });
});

test("an empty v2 update body leaves the record as it was", async ({ app }) => {
  const user = await firstUser(app);
  const authHeader = await getAuthHeader(app);

  const res = await app.inject({
    method: "put",
    url: `/v2/users/${user.id}`,
    headers: { ...authHeader },
    body: {},
  });
  expectStatus(res, 200);
  expect(res.json().phone).toBe(user.phone);
});

test("v2 creates and deletes its own users", async ({ app }) => {
  const authHeader = await getAuthHeader(app);

  const created = await app.inject({
    method: "post",
    url: "/v2/users",
    body: { ...buildUser(), phone: "+31 20 333 3333" },
  });
  expectStatus(created, 201);
  const { id } = created.json();

  const deleted = await app.inject({
    method: "delete",
    url: `/v2/users/${id}`,
    headers: { ...authHeader },
  });
  expectStatus(deleted, 204);

  const gone = await app.inject({ url: `/v2/users/${id}`, headers: { ...authHeader } });
  expectStatus(gone, 404);
});

// Обработчики v2 продублированы, а не переиспользованы из v1: значит и защиты у
// них свои, и забыть одну в половине версий легко. Поэтому список и отказ на
// удаление владельца курсов проверяются отдельно.
test("v2 lists users with their phone", async ({ app }) => {
  const authHeader = await getAuthHeader(app);

  const res = await app.inject({ url: "/v2/users", headers: { ...authHeader } });
  expectStatus(res, 200);
  expect(res.json().data[0]).toHaveProperty("phone");
});

test("v2 also refuses to delete a user who still owns courses", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "delete",
    url: `/v2/users/${course.creatorId}`,
    headers: { ...authHeader },
  });
  expectStatus(res, 409);
});

// Правило уникальности живёт в валидаторе v2 своей копией, поверх схем v2.
test("v2 rejects a duplicate email", async ({ app }) => {
  const user = await firstUser(app);

  const res = await app.inject({
    method: "post",
    url: "/v2/users",
    body: buildUser({ email: user.email.toUpperCase() }),
  });
  expectStatus(res, 422);
});
