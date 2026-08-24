import { test } from "vitest";
import * as assert from "node:assert";
import { build } from "../helper.ts";

// Ни /health, ни /metrics не было: оркестратору нечего опрашивать, а метрик по
// запросам не существовало вовсе.
test("health reports the app and its database", async () => {
  const app = await build();

  const res = await app.inject({ url: "/health" });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepStrictEqual(JSON.parse(res.body), { status: "ok" });
});

test("metrics are exposed in prometheus format", async () => {
  const app = await build();

  // Запрос до снятия метрик, чтобы серия по маршрутам была непустой.
  await app.inject({ url: "/courses" });

  const res = await app.inject({ url: "/metrics" });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /text\/plain/);
  assert.match(res.body, /http_request_duration_seconds/);
  assert.match(res.body, /process_cpu_seconds_total/);
});

// Операционные маршруты в контракте не описаны намеренно: они не часть API, и
// schemathesis их не проверяет. Но и ломать спеку они не должны.
test("operational routes stay outside the api contract", async () => {
  const app = await build();

  const document = await app.inject({ url: "/openapi.json" });
  const paths = Object.keys(JSON.parse(document.body).paths);
  assert.ok(!paths.includes("/health"), "health попал в контракт");
  assert.ok(!paths.includes("/metrics"), "metrics попал в контракт");
});

// Честная граница проверяемого: сам SDK поднимается только через --import в
// скриптах start/dev, поэтому тесты его не исполняют. Проверяется ровно то, что
// без указанного коллектора трассировка не включается.
test("tracing stays off without a collector endpoint", async () => {
  assert.equal(process.env.OTEL_EXPORTER_OTLP_ENDPOINT, undefined);

  const { telemetryEnabled, fastifyOtel } = await import("../../src/telemetry.ts");
  assert.equal(telemetryEnabled, false);
  assert.equal(fastifyOtel, undefined);
});
