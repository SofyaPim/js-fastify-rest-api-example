import { eq } from 'drizzle-orm';

import * as schemas from '../../db/schema.ts';
import { ensure } from '../../lib/utils.ts';
import type { RouteHandlers } from '../../types/handlers/fastify.gen.ts';

export default {
  async tokensCreate(request, reply) {
    const client = await request.db.query.users.findFirst({
      where: eq(schemas.users.email, request.body.email),
    });
    ensure(reply, client, 404);
    const token = request.server.jwt.sign({ id: client.id });
    return reply.code(201).send({ token });
  },
} satisfies Partial<RouteHandlers>;
