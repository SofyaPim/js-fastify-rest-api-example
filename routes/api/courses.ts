import { and, asc, eq } from 'drizzle-orm'

import * as schemas from '../../db/schema.ts'
import { getPagingOptions } from '../../lib/utils.ts'
import type { RouteHandlers } from '../../types/handlers/fastify.gen.ts'
import type { Course, CourseLesson } from '../../types/index.ts'
import CourseValidator from '../../validators/CourseValidator.ts'
import LessonValidator from '../../validators/Course/LessonValidator.ts'

export default {
  async coursesIndex(request, reply) {
    const page = request.query?.page ?? 1
    const courses = await request.db.query.courses.findMany({
      orderBy: asc(schemas.courses.id),
      ...getPagingOptions(page, 10),
    })
    return reply.code(200).send({ data: courses })
  },

  async coursesShow(request, reply) {
    const course = await request.db.query.courses.findFirst({
      where: eq(schemas.courses.id, request.params.id),
    })
    request.server.assert(course, 404)
    return reply.code(200).send(course)
  },

  async coursesCreate(request, reply) {
    await request.jwtVerify()
    const validated = await CourseValidator.validate(
      request.db,
      request.body as Course,
    )
    // attach creator id from auth if available
    const creatorId = (request.user as { id?: number } | undefined)?.id
    const values = {
      ...validated,
      creatorId: creatorId ?? validated?.['creatorId'] ?? 1,
    } as Course

    const [course] = await request.db
      .insert(schemas.courses)
      .values(values)
      .returning()
    return reply.code(201).send(course)
  },

  async coursesUpdate(request, reply) {
    await request.jwtVerify()
    const validated = await CourseValidator.validate(
      request.db,
      request.body as Course,
    )
    const [course] = await request.db
      .update(schemas.courses)
      .set(validated)
      .where(eq(schemas.courses.id, request.params.id))
      .returning()
    request.server.assert(course, 404)
    return reply.code(200).send(course)
  },

  async coursesDestroy(request, reply) {
    await request.jwtVerify()
    const [course] = await request.db
      .delete(schemas.courses)
      .where(eq(schemas.courses.id, request.params.id))
      .returning()
    request.server.assert(course, 404)
    return reply.code(204).send()
  },

  async coursesLessonsIndex(request, reply) {
    const page = request.query?.page ?? 1
    const lessons = await request.db.query.courseLessons.findMany({
      where: eq(schemas.courseLessons.courseId, request.params.courseId),
      orderBy: asc(schemas.courseLessons.id),
      ...getPagingOptions(page, 10),
    })
    return reply.code(200).send({ data: lessons })
  },

  async coursesLessonsShow(request, reply) {
    const lesson = await request.db.query.courseLessons.findFirst({
      where: and(
        eq(schemas.courseLessons.courseId, request.params.courseId),
        eq(schemas.courseLessons.id, request.params.id),
      ),
    })
    request.server.assert(lesson, 404)
    return reply.code(200).send(lesson)
  },

  async coursesLessonsCreate(request, reply) {
    await request.jwtVerify()
    const validated = await LessonValidator.validate(
      request.db,
      request.body as CourseLesson,
    )
    const values = {
      ...validated,
      courseId: request.params.courseId,
    } as CourseLesson
    const [lesson] = await request.db
      .insert(schemas.courseLessons)
      .values(values)
      .returning()
    return reply.code(201).send(lesson)
  },
} satisfies Partial<RouteHandlers>
