import fp from "fastify-plugin";
import { fastifyOtel, telemetryEnabled } from "../telemetry.ts";

export default fp(
  async (fastify) => {
    if (!telemetryEnabled || !fastifyOtel) return;

    // Регистрируется среди плагинов, то есть до того, как glue объявит
    // маршруты: иначе инструментация их не увидит.
    await fastify.register(fastifyOtel.plugin());
  },
  { name: "telemetry" },
);
