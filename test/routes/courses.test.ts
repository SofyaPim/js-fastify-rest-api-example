import { expect } from "vitest";
import {
  courseById,
  expectStatus,
  firstCourse,
  firstLesson,
  getAuthHeader,
  outsiderHeader,
  createTest,
} from "../helper.ts";
import { buildCourse } from "#src/lib/data.ts";
import * as schemas from "#src/db/schema.ts";

const test = createTest();
const MISSING_ID = 999_999;

test("get courses", async ({ app }) => {
  const res = await app.inject({ url: "/courses" });
  expectStatus(res, 200);
  expect(res.json()).toMatchObject({
    data: expect.any(Array),
    meta: { page: 1, perPage: 10, total: expect.any(Number) },
  });
});

test("get courses/:id", async ({ app }) => {
  const course = await firstCourse(app);

  const res = await app.inject({ url: `/courses/${course.id}` });
  expectStatus(res, 200);
  expect(res.json()).toMatchObject({ id: course.id, name: course.name });
});

test("post courses", async ({ app }) => {
  const authHeader = await getAuthHeader(app);
  const { name, description } = buildCourse();

  const res = await app.inject({
    method: "post",
    url: "/courses",
    headers: { ...authHeader },
    body: { name, description },
  });
  expectStatus(res, 201);
  expect(res.json()).toMatchObject({ id: expect.any(Number), name });
});

test("put courses/:id", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "put",
    url: `/courses/${course.id}`,
    headers: { ...authHeader },
    body: { name: "Renamed course" },
  });
  expectStatus(res, 200);
  expect((await courseById(app, course.id))?.name).toBe("Renamed course");
});

test("delete courses/:id", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "delete",
    url: `/courses/${course.id}`,
    headers: { ...authHeader },
  });
  expectStatus(res, 204);
  expect(await courseById(app, course.id)).toBeUndefined();
});

// Список и показ курса открыты, правка и удаление — нет. Список повторяет
// @useAuth из main.tsp намеренно: тест должен падать, если авторизацию отвяжут
// от спеки и снова начнут звать jwtVerify в обработчиках руками.
test("writing to courses requires a token, reading does not", async ({ app }) => {
  const writes = [
    { method: "post", url: "/courses", body: { name: "Course", description: "Text" } },
    { method: "put", url: "/courses/1", body: { name: "Renamed" } },
    { method: "delete", url: "/courses/1" },
  ] as const;

  const answered = [];
  for (const { method, url, ...rest } of writes) {
    const anonymous = await app.inject({ method, url, ...rest });
    const malformed = await app.inject({
      method,
      url,
      headers: { Authorization: "Bearer not-a-jwt" },
      ...rest,
    });
    answered.push([anonymous.statusCode, malformed.statusCode]);
  }
  expect(answered).toEqual(writes.map(() => [401, 401]));

  const course = await firstCourse(app);
  expectStatus(await app.inject({ url: "/courses" }), 200);
  expectStatus(await app.inject({ url: `/courses/${course.id}` }), 200);
});

test("operations on a missing course answer 404", async ({ app }) => {
  const authHeader = await getAuthHeader(app);

  const cases = [
    { method: "get", url: `/courses/${MISSING_ID}` },
    { method: "put", url: `/courses/${MISSING_ID}`, body: { name: "Nobody" } },
    { method: "delete", url: `/courses/${MISSING_ID}` },
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

// Проверялся только факт аутентификации, но не владение: любой пользователь с
// токеном правил и удалял чужие курсы.
test("a stranger cannot update someone else's course", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await outsiderHeader(app, course.creatorId);

  const res = await app.inject({
    method: "put",
    url: `/courses/${course.id}`,
    headers: { ...authHeader },
    body: { name: "Hijacked" },
  });
  expectStatus(res, 403);
  expect((await courseById(app, course.id))?.name).toBe(course.name);
});

test("a stranger cannot delete someone else's course", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await outsiderHeader(app, course.creatorId);

  const res = await app.inject({
    method: "delete",
    url: `/courses/${course.id}`,
    headers: { ...authHeader },
  });
  expectStatus(res, 403);
  expect(await courseById(app, course.id)).toBeDefined();
});

// Пустое тело нашёл schemathesis: drizzle на пустом set бросает «No values to
// set», и правка падала в 500.
test("an empty update body leaves the record as it was", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "put",
    url: `/courses/${course.id}`,
    headers: { ...authHeader },
    body: {},
  });

  expectStatus(res, 200);
  expect(res.json().name).toBe(course.name);
});

// Уроки удаляются вместе с курсом явно, в транзакции обработчика, а не каскадом
// из миграции: поведение должно быть видно в коде и покрыто тестом.
test("deleting a course removes its lessons", async ({ app }) => {
  const lesson = await firstLesson(app);
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "delete",
    url: `/courses/${lesson.courseId}`,
    headers: { ...authHeader },
  });
  expectStatus(res, 204);

  const left = await app.db.query.courseLessons.findMany();
  expect(left.filter((item) => item.courseId === lesson.courseId)).toEqual([]);
});

// Без условных запросов два одновременных PUT молча перезаписывают друг друга:
// второй не знает, что запись изменилась после того, как он её прочитал.
test("a course carries an ETag and honours If-None-Match", async ({ app }) => {
  const course = await firstCourse(app);

  const first = await app.inject({ url: `/courses/${course.id}` });
  expectStatus(first, 200);
  const tag = first.headers.etag as string;
  expect(tag).toMatch(/^W\/"\d+"$/);

  const cached = await app.inject({
    url: `/courses/${course.id}`,
    headers: { "If-None-Match": tag },
  });
  expect({ status: cached.statusCode, body: cached.body }).toEqual({ status: 304, body: "" });
});

test("a stale If-Match is rejected instead of overwriting", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const fetched = await app.inject({ url: `/courses/${course.id}` });
  const stale = fetched.headers.etag as string;

  // Кто-то другой успел изменить запись.
  const other = await app.inject({
    method: "put",
    url: `/courses/${course.id}`,
    headers: { ...authHeader },
    body: { name: "Changed by someone else" },
  });
  expectStatus(other, 200);

  const conflicting = await app.inject({
    method: "put",
    url: `/courses/${course.id}`,
    headers: { ...authHeader, "If-Match": stale },
    body: { name: "Would silently overwrite" },
  });
  expectStatus(conflicting, 412);
  expect((await courseById(app, course.id))?.name).toBe("Changed by someone else");
});

test("a fresh If-Match goes through and moves the validator", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const fetched = await app.inject({ url: `/courses/${course.id}` });
  const fresh = fetched.headers.etag as string;

  const res = await app.inject({
    method: "put",
    url: `/courses/${course.id}`,
    headers: { ...authHeader, "If-Match": fresh },
    body: { name: "Renamed with a fresh validator" },
  });
  expectStatus(res, 200);
  expect(res.headers.etag).not.toBe(fresh);
});

// Заголовок необязателен: клиенты, которым конкурентность не важна, работают
// как раньше.
test("a request without If-Match still works", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "put",
    url: `/courses/${course.id}`,
    headers: { ...authHeader },
    body: { name: "No precondition" },
  });
  expectStatus(res, 200);
});

test("a stale If-Match blocks deletion too", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const fetched = await app.inject({ url: `/courses/${course.id}` });
  const stale = fetched.headers.etag as string;

  await app.inject({
    method: "put",
    url: `/courses/${course.id}`,
    headers: { ...authHeader },
    body: { name: "Touched" },
  });

  const res = await app.inject({
    method: "delete",
    url: `/courses/${course.id}`,
    headers: { ...authHeader, "If-Match": stale },
  });
  expectStatus(res, 412);
  expect(await courseById(app, course.id)).toBeDefined();
});

// page уходил в запрос, а обратно не возвращалось ничего: понять, есть ли
// следующая страница, клиент по контракту не мог.
test("a list reports where the client is and how much there is", async ({ app }) => {
  const course = await firstCourse(app);

  // Доводим до семи курсов, чтобы страниц было заведомо больше одной.
  const existing = await app.db.query.courses.findMany();
  for (let i = existing.length; i < 7; i += 1) {
    await app.db.insert(schemas.courses).values(buildCourse({ creatorId: course.creatorId }));
  }

  const first = await app.inject({ url: "/courses?page=1&perPage=3" });
  expectStatus(first, 200);
  const firstPage = first.json();
  expect(firstPage.meta).toEqual({ page: 1, perPage: 3, total: 7, totalPages: 3 });
  expect(firstPage.data).toHaveLength(3);

  const last = await app.inject({ url: "/courses?page=3&perPage=3" });
  expectStatus(last, 200);
  const lastPage = last.json();
  expect(lastPage.meta.page).toBe(3);
  expect(lastPage.data).toHaveLength(1);
});

test("a page past the end is empty but still reports the total", async ({ app }) => {
  const res = await app.inject({ url: "/courses?page=99&perPage=10" });
  expectStatus(res, 200);
  const page = res.json();
  expect(page.data).toEqual([]);
  expect(page.meta.total).toBeGreaterThan(0);
});

// Курсы одни на обе версии: расходятся только пользователи, а обработчики
// курсов переиспользуются обеими регистрациями glue.
test("courses answer under both versions", async ({ app }) => {
  for (const prefix of ["", "/v2"]) {
    const res = await app.inject({ url: `${prefix}/courses` });
    expectStatus(res, 200);
    expect(res.json().data).toEqual(expect.any(Array));
  }
});
