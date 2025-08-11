import { asc, eq } from 'drizzle-orm';

import * as schemas from '../../db/schema.ts';
import { getPagingOptions, openapi } from '../../lib/utils.ts';
import type { RouteHandlers } from '../../types/handlers/fastify.gen.ts';
import type { User } from '../../types/index.ts';
import UserValidator from '../../validators/UserValidator.ts';

export default {
  async usersIndex(request, reply) {
    const page = request.query?.page ?? 1;
    const users = await request.db.query.users.findMany({
      orderBy: asc(schemas.users.id),
      ...getPagingOptions(page, 1),
    });

    return reply.code(200).send({ data: users });
  },
  async usersShow(request, reply) {
    const user = await request.db.query.users.findFirst({
      where: eq(schemas.users.id, request.params.id),
    });
    request.server.assert(user, 404);
    return reply.code(200).send(user);
  },

  async usersCreate(request, reply) {
    const validated = await UserValidator.validate(request.db, request.body as User);
    const [user] = await request.db
      .insert(schemas.users)
      .values(validated)
      .returning();

    return reply.code(201).send(user);
  },

  async usersUpdate(request, reply) {
    const validated = await UserValidator.validate(request.db, request.body as User);
    const [user] = await request.db
      .update(schemas.users)
      .set(validated)
      .where(eq(schemas.users.id, request.params.id))
      .returning();
    request.server.assert(user, 404);

    return reply.code(200).send(user);
  },

  async usersDestroy(request, reply) {
    const [user] = await request.db
      .delete(schemas.users)
      .where(eq(schemas.users.id, request.params.id))
      .returning();
    request.server.assert(user, 404);
    return reply.code(204).send();
  },
} satisfies Partial<RouteHandlers>;
