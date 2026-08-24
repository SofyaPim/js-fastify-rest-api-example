import { test } from "vitest";
import * as assert from "node:assert";
import { buildClient, responseOf } from "../../helper.ts";
import { buildCourse } from "../../../src/lib/data.ts";
import * as schemas from "../../../src/db/schema.ts";
import { coursesIndex } from "../../../src/types/handlers/v1/sdk.gen.js";

// page уходил в запрос, а обратно не возвращалось ничего: понять, есть ли
// следующая страница, клиент по контракту не мог.
test("a list reports where the client is and how much there is", async () => {
  const { app, client } = await buildClient();

  const course = await app.db.query.courses.findFirst();
  assert.ok(course);
  // Доводим до семи курсов, чтобы страниц было заведомо больше одной.
  const existing = await app.db.query.courses.findMany();
  for (let i = existing.length; i < 7; i += 1) {
    await app.db.insert(schemas.courses).values(buildCourse({ creatorId: course.creatorId }));
  }

  const first = await coursesIndex({ client, query: { page: 1, perPage: 3 } });
  assert.equal(responseOf(first).status, 200);
  assert.deepStrictEqual(first.data?.meta, { page: 1, perPage: 3, total: 7, totalPages: 3 });
  assert.equal(first.data?.data.length, 3);

  const last = await coursesIndex({ client, query: { page: 3, perPage: 3 } });
  assert.equal(responseOf(last).status, 200);
  assert.equal(last.data?.meta.page, 3);
  assert.equal(last.data?.data.length, 1);
});

test("a page past the end is empty but still reports the total", async () => {
  const { client } = await buildClient();

  const res = await coursesIndex({ client, query: { page: 99, perPage: 10 } });
  assert.equal(responseOf(res).status, 200);
  assert.equal(res.data?.data.length, 0);
  assert.ok(res.data && res.data.meta.total > 0);
});

// perPage не должен позволять вытащить базу одним запросом.
test("perPage is bounded by the contract", async () => {
  const { app } = await buildClient();

  const tooBig = await app.inject({ url: "/courses?perPage=1000" });
  assert.equal(tooBig.statusCode, 400, tooBig.body);

  const zero = await app.inject({ url: "/courses?perPage=0" });
  assert.equal(zero.statusCode, 400, zero.body);
});

// total считается по тому же условию, что выборка: у списка уроков это уроки
// одного курса, а не все.
test("nested lists count only their own scope", async () => {
  const { app, client } = await buildClient();

  const lesson = await app.db.query.courseLessons.findFirst();
  assert.ok(lesson);

  const res = await app.inject({ url: `/courses/${lesson.courseId}/lessons` });
  assert.equal(res.statusCode, 200, res.body);
  const body = JSON.parse(res.body);

  const all = await app.db.query.courseLessons.findMany();
  const mine = all.filter((item) => item.courseId === lesson.courseId);
  assert.equal(body.meta.total, mine.length);
  assert.ok(client);
});
