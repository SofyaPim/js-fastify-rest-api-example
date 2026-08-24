import { httpErrors } from "@fastify/sensible";
import { and, asc, count, eq } from "drizzle-orm";

import * as schemas from "../../../db/schema.ts";
import { buildPageMeta, defineHandlers, ensure, getPagingOptions } from "../../../lib/utils.ts";
import CoursePolicy from "../../../policies/CoursePolicy.ts";
import LessonValidator from "../../../validators/Course/LessonValidator.ts";

const handlers = defineHandlers({
  async coursesLessonsIndex(request, reply) {
    const page = request.query?.page ?? 1;
    const perPage = request.query?.perPage ?? 10;
    const scope = eq(schemas.courseLessons.courseId, request.params.courseId);

    const lessons = await request.db.query.courseLessons.findMany({
      where: scope,
      orderBy: asc(schemas.courseLessons.id),
      ...getPagingOptions(page, perPage),
    });
    // Счёт по тому же условию, что и выборка: total должен быть числом уроков
    // этого курса, а не всех.
    const [{ total }] = await request.db
      .select({ total: count() })
      .from(schemas.courseLessons)
      .where(scope);

    return reply.code(200).send({ data: lessons, meta: buildPageMeta(page, perPage, total) });
  },

  async coursesLessonsShow(request, reply) {
    const lesson = await request.db.query.courseLessons.findFirst({
      where: and(
        eq(schemas.courseLessons.courseId, request.params.courseId),
        eq(schemas.courseLessons.id, request.params.id),
      ),
    });
    ensure(lesson, 404);
    return reply.code(200).send(lesson);
  },

  // Урок добавляется в чужой курс, поэтому право проверяется по курсу. Раньше
  // хватало любого токена, а несуществующий курс упирался в ограничение
  // внешнего ключа и давал 500.
  async coursesLessonsCreate(request, reply) {
    const course = await request.db.query.courses.findFirst({
      where: eq(schemas.courses.id, request.params.courseId),
    });
    ensure(course, 404);
    if (!CoursePolicy.canManageLessons(course, request.user.id)) {
      throw httpErrors.forbidden("You can only add lessons to your own courses");
    }

    const validated = await LessonValidator.validateCreate(request.db, request.body);
    const values = {
      ...validated,
      courseId: request.params.courseId,
    };
    const [lesson] = await request.db.insert(schemas.courseLessons).values(values).returning();
    return reply.code(201).send(lesson);
  },

  async coursesLessonsUpdate(request, reply) {
    const course = await request.db.query.courses.findFirst({
      where: eq(schemas.courses.id, request.params.courseId),
    });
    ensure(course, 404);
    if (!CoursePolicy.canManageLessons(course, request.user.id)) {
      throw httpErrors.forbidden("You can only change lessons of your own courses");
    }

    const where = and(
      eq(schemas.courseLessons.courseId, request.params.courseId),
      eq(schemas.courseLessons.id, request.params.id),
    );
    const existing = await request.db.query.courseLessons.findFirst({ where });
    ensure(existing, 404);

    const validated = await LessonValidator.validateEdit(request.db, request.body);
    // Все поля EditDTO необязательные: drizzle на пустом set бросает
    // «No values to set».
    if (Object.keys(validated).length === 0) {
      return reply.code(200).send(existing);
    }

    const [lesson] = await request.db
      .update(schemas.courseLessons)
      .set(validated)
      .where(where)
      .returning();
    return reply.code(200).send(lesson);
  },

  async coursesLessonsDestroy(request, reply) {
    const course = await request.db.query.courses.findFirst({
      where: eq(schemas.courses.id, request.params.courseId),
    });
    ensure(course, 404);
    if (!CoursePolicy.canManageLessons(course, request.user.id)) {
      throw httpErrors.forbidden("You can only delete lessons of your own courses");
    }

    const where = and(
      eq(schemas.courseLessons.courseId, request.params.courseId),
      eq(schemas.courseLessons.id, request.params.id),
    );
    const existing = await request.db.query.courseLessons.findFirst({ where });
    ensure(existing, 404);

    await request.db.delete(schemas.courseLessons).where(where);
    return reply.code(204).send();
  },
});

export default handlers;
