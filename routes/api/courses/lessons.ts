import { and, asc, eq } from 'drizzle-orm';

import * as schemas from '../../../db/schema.ts';
import { ensure, getPagingOptions } from '../../../lib/utils.ts';
import type { RouteHandlers } from '../../../types/handlers/fastify.gen.ts';
import type { CourseLesson } from '../../../types/index.ts';
import LessonValidator from '../../../validators/Course/LessonValidator.ts';

export default {
  async coursesLessonsIndex(request, reply) {
    const page = request.query?.page ?? 1;
    const lessons = await request.db.query.courseLessons.findMany({
      where: eq(schemas.courseLessons.courseId, request.params.courseId),
      orderBy: asc(schemas.courseLessons.id),
      ...getPagingOptions(page, 10),
    });
    return reply.code(200).send({ data: lessons });
  },

  async coursesLessonsShow(request, reply) {
    const lesson = await request.db.query.courseLessons.findFirst({
      where: and(
        eq(schemas.courseLessons.courseId, request.params.courseId),
        eq(schemas.courseLessons.id, request.params.id),
      ),
    });
    ensure(reply, lesson, 404);
    return reply.code(200).send(lesson);
  },

  async coursesLessonsCreate(request, reply) {
    await request.jwtVerify();
    const validated = await LessonValidator.validate(
      request.db,
      request.body as CourseLesson,
    );
    const values = {
      ...validated,
      courseId: request.params.courseId,
    } as CourseLesson;
    const [lesson] = await request.db
      .insert(schemas.courseLessons)
      .values(values)
      .returning();
    return reply.code(201).send(lesson);
  },
} satisfies Partial<RouteHandlers>;

