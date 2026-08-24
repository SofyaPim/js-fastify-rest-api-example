import { afterAll, beforeAll, expect, test as base } from "vitest";
import { asc, eq } from "drizzle-orm";
import Fastify, { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import app from "#src/app.ts";
import * as schemas from "#src/db/schema.ts";
import type { DrizzleDB } from "#src/types/index.ts";

// Поднимает приложение и отдаёт его вызывающему — закрывает он же. Прямо в
// тестах нужен только там, где проверяется сам старт; остальным хватает
// useApp().
//
// Приложение собирается напрямую, а не через helper из fastify-cli. Тот грузит
// app.ts сам, в обход трансформации vite: из-за этого весь app в тестах был
// any, а покрытие показывало по обработчикам единицы процентов при живых
// тестах на них.
async function build(): Promise<FastifyInstance> {
  // pluginTimeout поднят с дефолтных 10 секунд: drizzle поднимает PGlite —
  // postgres в wasm — прогоняет миграции и сиды, и на параллельном прогоне
  // файлов старт в десять секунд не укладывается.
  const fastify = Fastify({ logger: { level: "error" }, pluginTimeout: 60_000 });
  // fp снимает инкапсуляцию, и декораторы приложения (db, jwt) видны снаружи.
  // В бою так не нужно — это только чтобы тесты могли дотянуться до базы.
  fastify.register(fp(app));
  await fastify.ready();

  return fastify;
}

const ROLLBACK = Symbol("rollback");

// Транзакция начинается в одном месте, а заканчивается в другом, поэтому её
// промису нужны ручки наружу.
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

// Приложение поднимается один раз на файл, а не на каждый тест: сборка fastify,
// регистрация двух документов OpenAPI, миграции и сиды стоят секунды, и
// повторять их на каждый тест незачем.
//
// Изоляция — транзакцией: тест получает приложение фикстурой, работает внутри
// транзакции и по выходу откатывает её, так что следующий видит ровно сиды.
// Приложению на время теста подсовывается tx, а не голый BEGIN: обработчик
// удаления курса открывает свою транзакцию, и через tx drizzle делает SAVEPOINT
// вместо второго BEGIN, чей COMMIT закрыл бы внешнюю.
function createTest() {
  let instance: FastifyInstance;
  let seeded: DrizzleDB;

  beforeAll(async () => {
    instance = await build();
    seeded = instance.db;
  });

  afterAll(async () => {
    await instance?.close();
  });

  return base.extend<{ app: FastifyInstance }>({
    // Первый аргумент фикстуры деструктурируется намеренно: по нему vitest
    // определяет зависимости, а сам контекст здесь не нужен.
    app: async ({ task: _task }, use) => {
      const opened = deferred();
      const finished = deferred<never>();

      const transaction = seeded
        .transaction(async (tx) => {
          instance.db = tx as unknown as DrizzleDB;
          opened.resolve();
          await finished.promise;
        })
        .catch((error) => {
          if (error !== ROLLBACK) throw error;
        });
      await opened.promise;

      await use(instance);

      finished.reject(ROLLBACK);
      await transaction;
      instance.db = seeded;
    },
  });
}

// Проверка с сужением типа: findFirst отдаёт T | undefined, и без этого каждый
// тест начинался бы с доказательства тайпскрипту, что запись нашлась. expect
// сам тип не сужает, поэтому нужна сигнатура asserts.
function expectDefined<T>(value: T): asserts value is NonNullable<T> {
  expect(value ?? null).not.toBeNull();
}

// Статус проверяется вместе с телом: expect печатает полученное значение
// целиком, поэтому при падении сразу видно, из-за чего сервер ответил не так.
// Иначе пришлось бы дописывать тело сообщением в каждый ассерт.
function expectStatus(res: { statusCode: number; body: string }, status: number) {
  expect({ status: res.statusCode, body: res.body }).toMatchObject({ status });
}

// Фикстуры из сидов. Порядок задан явно: без ORDER BY postgres его не обещает,
// и «первая» запись до правки и после неё — не обязательно одна и та же.
async function firstUser(app: FastifyInstance) {
  const user = await app.db.query.users.findFirst({ orderBy: asc(schemas.users.id) });
  expectDefined(user);
  return user;
}

async function firstCourse(app: FastifyInstance) {
  const course = await app.db.query.courses.findFirst({ orderBy: asc(schemas.courses.id) });
  expectDefined(course);
  return course;
}

async function firstLesson(app: FastifyInstance) {
  const lesson = await app.db.query.courseLessons.findFirst({
    orderBy: asc(schemas.courseLessons.id),
  });
  expectDefined(lesson);
  return lesson;
}

async function courseById(app: FastifyInstance, id: number) {
  return app.db.query.courses.findFirst({ where: eq(schemas.courses.id, id) });
}

async function userById(app: FastifyInstance, id: number) {
  return app.db.query.users.findFirst({ where: eq(schemas.users.id, id) });
}

// Заголовок пользователя, который эту запись не создавал: владение проверяется
// отдельно от аутентификации, и токеном «просто залогиненного» его не подменить.
async function outsiderHeader(app: FastifyInstance, ownerId: number) {
  const users = await app.db.query.users.findMany();
  const outsider = users.find((user) => user.id !== ownerId);
  expectDefined(outsider);
  return getAuthHeader(app, outsider.id);
}

async function getAuthHeader(app: FastifyInstance, userId: number | null = null) {
  const user = userId ? await userById(app, userId) : await firstUser(app);
  expectDefined(user);
  return {
    Authorization: `Bearer ${app.jwt.sign({ id: user.id })}`,
  };
}

export {
  build,
  courseById,
  createTest,
  expectDefined,
  expectStatus,
  firstCourse,
  firstLesson,
  firstUser,
  getAuthHeader,
  outsiderHeader,
  userById,
};
