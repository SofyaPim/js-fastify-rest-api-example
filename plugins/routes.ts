import fp from 'fastify-plugin';
import { globby } from 'globby';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FastifyPluginAsync } from 'fastify';

export default fp(async function (app) {
  // Try to load generated route handlers; skip if not present
  let glue: FastifyPluginAsync<{
    serviceHandlers: Record<string, unknown>;
  }> | null;
  try {
    const mod = (await import('../types/handlers/index.js')) as {
      glue?: FastifyPluginAsync<{ serviceHandlers: Record<string, unknown> }>;
    };
    glue = mod.glue ?? null;
  } catch {
    glue = null;
  }

  if (!glue) return;

  const files = await globby(
    path.join(import.meta.dirname, '../routes/**/*.ts'),
    {
      absolute: true,
    },
  );

  const serviceHandlers: Record<string, unknown> = {};
  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    Object.assign(serviceHandlers, mod);
  }

  const options = { serviceHandlers } satisfies {
    serviceHandlers: Record<string, unknown>;
  };
  await app.register(glue, options);
});
