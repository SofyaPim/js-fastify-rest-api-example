// Трассировка. Загружается через --import в скриптах start/dev, то есть до
// приложения: инструментация http должна успеть подменить модуль до того, как
// его затянет fastify.
//
// Конфиг читается из process.env напрямую, а не через схему @fastify/env: этот
// модуль исполняется раньше приложения, и плагина в этот момент нет. Имена
// переменных — стандартные для OpenTelemetry, так что валидировать их своей
// схемой было бы скорее вредно.
import { FastifyOtelInstrumentation } from "@fastify/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

// Без указанного коллектора трассировка не включается вовсе: иначе каждый
// запуск тянул бы SDK и писал спаны в никуда.
export const telemetryEnabled = Boolean(endpoint);

export const fastifyOtel = telemetryEnabled ? new FastifyOtelInstrumentation() : undefined;

if (telemetryEnabled && fastifyOtel) {
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "js-fastify-rest-api-example",
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [new HttpInstrumentation(), fastifyOtel],
  });

  sdk.start();

  // Спаны копятся в буфере, поэтому на выходе его надо слить, иначе теряется
  // последняя партия.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      sdk.shutdown().finally(() => process.exit(0));
    });
  }
}
