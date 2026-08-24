import env from "@fastify/env";
import fp from "fastify-plugin";

// Конфиг проверяется схемой на старте: приложение с пустым JWT_SECRET не
// поднимется вовсе, вместо того чтобы молча подписывать токены строкой
// "supersecret", как было раньше.
const schema = {
  type: "object",
  required: ["JWT_SECRET"],
  properties: {
    JWT_SECRET: { type: "string", minLength: 32 },
    // Срок жизни токена. Без него @fastify/jwt подписывает бессрочные: один
    // раз выданный токен работал бы всегда, а отозвать его можно было только
    // удалением пользователя.
    JWT_EXPIRES_IN: { type: "string", default: "1h" },
    NODE_ENV: { type: "string", default: "development" },
    CORS_ORIGIN: { type: "string", default: "*" },
    // Лимит на IP в минуту. В тестах приложение поднимается десятки раз в одном
    // процессе, поэтому значение выносится наружу, а не зашивается в код.
    RATE_LIMIT_MAX: { type: "number", default: 100 },
    // Порог шеддинга под нагрузкой. Выносится наружу по той же причине, что и
    // лимитер: на загруженной машине under-pressure начинает отдавать 503 на
    // всё подряд, и прогон тестов рассыпается не по вине кода.
    MAX_EVENT_LOOP_DELAY: { type: "number", default: 1000 },
    MAX_EVENT_LOOP_UTILIZATION: { type: "number", default: 0.98 },
  },
} as const;

export default fp(
  async (fastify) => {
    // .env не читается в тестах: иначе они начинают зависеть от локального
    // файла разработчика, а проверка «без секрета приложение не поднимается»
    // ломается — dotenv подтягивает секрет обратно после его удаления из
    // окружения. В тестах переменные приходят из vitest.config.ts.
    await fastify.register(env, { schema, dotenv: process.env.NODE_ENV !== "test" });
  },
  { name: "env" },
);
