import { expect } from "vitest";
import { createTest, expectStatus, firstUser, getAuthHeader } from "../helper.ts";
import { DEFAULT_PASSWORD } from "#src/lib/data.ts";

const test = createTest();

test("post tokens", async ({ app }) => {
  const user = await firstUser(app);

  const res = await app.inject({
    method: "post",
    url: "/tokens",
    body: { email: user.email, password: DEFAULT_PASSWORD },
  });
  expectStatus(res, 201);
  expect(res.json().token).toEqual(expect.any(String));
});

// Выдача токена не требует токена — иначе получить первый было бы нечем.
test("post tokens needs no token itself", async ({ app }) => {
  const user = await firstUser(app);

  const res = await app.inject({
    method: "post",
    url: "/tokens",
    headers: {},
    body: { email: user.email, password: DEFAULT_PASSWORD },
  });
  expectStatus(res, 201);
});

test("post tokens rejects a wrong password", async ({ app }) => {
  const user = await firstUser(app);

  const res = await app.inject({
    method: "post",
    url: "/tokens",
    body: { email: user.email, password: "definitely-not-the-password" },
  });
  expectStatus(res, 401);
});

// Неизвестный email раньше давал 500: ensure() ошибку не бросал, и обработчик
// шёл дальше читать поле у undefined.
test("post tokens rejects an unknown email", async ({ app }) => {
  const res = await app.inject({
    method: "post",
    url: "/tokens",
    body: { email: "nobody@hexlet.io", password: DEFAULT_PASSWORD },
  });
  expectStatus(res, 401);
});

// Ответ на неизвестный email и на неверный пароль обязан совпадать, иначе по
// эндпоинту можно перебирать зарегистрированные адреса.
test("post tokens does not reveal whether an email is registered", async ({ app }) => {
  const user = await firstUser(app);

  const unknown = await app.inject({
    method: "post",
    url: "/tokens",
    body: { email: "nobody@hexlet.io", password: DEFAULT_PASSWORD },
  });
  const wrongPassword = await app.inject({
    method: "post",
    url: "/tokens",
    body: { email: user.email, password: "definitely-not-the-password" },
  });

  expect({ status: unknown.statusCode, body: unknown.body }).toEqual({
    status: wrongPassword.statusCode,
    body: wrongPassword.body,
  });
});

// Токены подписывались без exp, то есть выданный однажды работал вечно, и
// отозвать его можно было только удалением пользователя.
test("tokens carry an expiry", async ({ app }) => {
  const user = await firstUser(app);

  const token = app.jwt.sign({ id: user.id });
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  expect(payload).toMatchObject({ exp: expect.any(Number), iat: expect.any(Number) });
  expect(payload.exp).toBeGreaterThan(payload.iat);
});

test("an expired token does not authenticate", async ({ app }) => {
  const user = await firstUser(app);

  const expired = app.jwt.sign({ id: user.id }, { expiresIn: "-1s" });
  const res = await app.inject({
    url: "/users",
    headers: { Authorization: `Bearer ${expired}` },
  });
  expectStatus(res, 401);
});

// Токен остаётся подписанным и не истёкшим после удаления аккаунта. Раньше
// такой запрос доходил до обработчика и падал на внешнем ключе с 500.
test("a token for a deleted user no longer authenticates", async ({ app }) => {
  const user = await firstUser(app);
  const authHeader = await getAuthHeader(app, user.id);

  expectStatus(await app.inject({ url: "/users", headers: { ...authHeader } }), 200);

  const deleted = await app.inject({
    method: "delete",
    url: `/users/${user.id}`,
    headers: { ...authHeader },
  });
  expectStatus(deleted, 204);

  const after = await app.inject({ url: "/users", headers: { ...authHeader } });
  expectStatus(after, 401);
});
