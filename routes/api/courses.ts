import { asc, eq } from 'drizzle-orm';

import * as schemas from '../../db/schema.ts';
import { ensure, getPagingOptions } from '../../lib/utils.ts';
import type { RouteHandlers } from '../../types/handlers/fastify.gen.ts';
import type { Course } from '../../types/index.ts';
import CourseValidator from '../../validators/CourseValidator.ts';

export default {
  async coursesIndex(request, reply) {
    const page = request.query?.page ?? 1;
    const courses = await request.db.query.courses.findMany({
      orderBy: asc(schemas.courses.id),
      ...getPagingOptions(page, 10),
    });
    return reply.code(200).send({ data: courses });
  },

  async coursesShow(request, reply) {
    const course = await request.db.query.courses.findFirst({
      where: eq(schemas.courses.id, request.params.id),
    });
    ensure(reply, course, 404);
    return reply.code(200).send(course);
  },

  async coursesCreate(request, reply) {
    await request.jwtVerify();
    const validated = await CourseValidator.validate(
      request.db,
      request.body as Course,
    );
    // attach creator id from auth if available
    const creatorId = request.user?.id;
    const values = {
      ...validated,
      creatorId: creatorId,
    } as Course;

    const [course] = await request.db
      .insert(schemas.courses)
      .values(values)
      .returning();
    return reply.code(201).send(course);
  },

  async coursesUpdate(request, reply) {
    await request.jwtVerify();
    const validated = await CourseValidator.validate(
      request.db,
      request.body as Course,
    );
    const [course] = await request.db
      .update(schemas.courses)
      .set(validated)
      .where(eq(schemas.courses.id, request.params.id))
      .returning();
    ensure(reply, course, 404);
    return reply.code(200).send(course);
  },

  async coursesDestroy(request, reply) {
    await request.jwtVerify();
    const [course] = await request.db
      .delete(schemas.courses)
      .where(eq(schemas.courses.id, request.params.id))
      .returning();
    ensure(reply, course, 404);
    return reply.code(204).send();
  },
} satisfies Partial<RouteHandlers>;
