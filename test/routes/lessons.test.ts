import { expect } from "vitest";
import {
  expectStatus,
  firstCourse,
  firstLesson,
  getAuthHeader,
  outsiderHeader,
  createTest,
} from "../helper.ts";
import { buildCourseLesson } from "#src/lib/data.ts";

const test = createTest();
const MISSING_ID = 999_999;

test("get lessons", async ({ app }) => {
  const lesson = await firstLesson(app);

  const res = await app.inject({ url: `/v1/courses/${lesson.courseId}/lessons` });
  expectStatus(res, 200);
  expect(res.json()).toMatchObject({ data: expect.any(Array), meta: { page: 1 } });
});

test("get lessons/:id", async ({ app }) => {
  const lesson = await firstLesson(app);

  const res = await app.inject({ url: `/v1/courses/${lesson.courseId}/lessons/${lesson.id}` });
  expectStatus(res, 200);
  expect(res.json()).toMatchObject({ id: lesson.id, name: lesson.name });
});

test("post lessons", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);
  const { name, body } = buildCourseLesson();

  const res = await app.inject({
    method: "post",
    url: `/v1/courses/${course.id}/lessons`,
    headers: { ...authHeader },
    body: { name, body },
  });
  expectStatus(res, 201);
  expect(res.json()).toMatchObject({ id: expect.any(Number), name });
});

test("put lessons/:id", async ({ app }) => {
  const lesson = await firstLesson(app);
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "put",
    url: `/v1/courses/${lesson.courseId}/lessons/${lesson.id}`,
    headers: { ...authHeader },
    body: { name: "Renamed lesson" },
  });
  expectStatus(res, 200);
  expect(res.json().name).toBe("Renamed lesson");
});

test("delete lessons/:id", async ({ app }) => {
  const lesson = await firstLesson(app);
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "delete",
    url: `/v1/courses/${lesson.courseId}/lessons/${lesson.id}`,
    headers: { ...authHeader },
  });
  expectStatus(res, 204);

  const gone = await app.inject({ url: `/v1/courses/${lesson.courseId}/lessons/${lesson.id}` });
  expectStatus(gone, 404);
});

test("writing lessons requires a token, reading does not", async ({ app }) => {
  const lesson = await firstLesson(app);

  const write = await app.inject({
    method: "post",
    url: `/v1/courses/${lesson.courseId}/lessons`,
    body: { name: "Lesson", body: "Text" },
  });
  expectStatus(write, 401);

  const read = await app.inject({ url: `/v1/courses/${lesson.courseId}/lessons` });
  expectStatus(read, 200);
});

test("a missing lesson answers 404", async ({ app }) => {
  const lesson = await firstLesson(app);

  const res = await app.inject({ url: `/v1/courses/${lesson.courseId}/lessons/${MISSING_ID}` });
  expectStatus(res, 404);
});

// Несуществующий курс раньше упирался в ограничение внешнего ключа и давал 500.
test("adding a lesson to a missing course answers 404", async ({ app }) => {
  const authHeader = await getAuthHeader(app);

  const res = await app.inject({
    method: "post",
    url: `/v1/courses/${MISSING_ID}/lessons`,
    headers: { ...authHeader },
    body: buildCourseLesson(),
  });
  expectStatus(res, 404);
});

// Уроки принадлежат владельцу курса: отдельного владельца у урока нет, и
// проверять надо создателя курса, в который его дописывают.
test("a stranger cannot add a lesson to someone else's course", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await outsiderHeader(app, course.creatorId);

  const res = await app.inject({
    method: "post",
    url: `/v1/courses/${course.id}/lessons`,
    headers: { ...authHeader },
    body: buildCourseLesson(),
  });
  expectStatus(res, 403);
});

test("a stranger cannot change or delete lessons of someone else's course", async ({ app }) => {
  const course = await firstCourse(app);
  const lesson = await firstLesson(app);
  const authHeader = await outsiderHeader(app, course.creatorId);

  const updated = await app.inject({
    method: "put",
    url: `/v1/courses/${lesson.courseId}/lessons/${lesson.id}`,
    headers: { ...authHeader },
    body: { name: "Hijacked lesson" },
  });
  expectStatus(updated, 403);

  const deleted = await app.inject({
    method: "delete",
    url: `/v1/courses/${lesson.courseId}/lessons/${lesson.id}`,
    headers: { ...authHeader },
  });
  expectStatus(deleted, 403);

  const survivors = await app.db.query.courseLessons.findMany();
  expect(survivors.map((item) => item.id)).toContain(lesson.id);
});

test("the owner extends their own course with a lesson", async ({ app }) => {
  const course = await firstCourse(app);
  const authHeader = await getAuthHeader(app, course.creatorId);

  const res = await app.inject({
    method: "post",
    url: `/v1/courses/${course.id}/lessons`,
    headers: { ...authHeader },
    body: buildCourseLesson(),
  });
  expectStatus(res, 201);
});

// total считается по тому же условию, что выборка: у списка уроков это уроки
// одного курса, а не все.
test("a nested list counts only its own scope", async ({ app }) => {
  const lesson = await firstLesson(app);

  const res = await app.inject({ url: `/v1/courses/${lesson.courseId}/lessons` });
  expectStatus(res, 200);

  const all = await app.db.query.courseLessons.findMany();
  const mine = all.filter((item) => item.courseId === lesson.courseId);
  expect(res.json().meta.total).toBe(mine.length);
});
