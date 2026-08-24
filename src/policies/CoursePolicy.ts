import type { Course } from "../types/index.ts";

// Права на курс отдельно от обработчиков: правило одно и то же для правки,
// удаления и работы с уроками, а список операций растёт.
export default class CoursePolicy {
  static canUpdate(course: Course, userId: number) {
    return course.creatorId === userId;
  }

  static canDestroy(course: Course, userId: number) {
    return course.creatorId === userId;
  }

  // Уроки принадлежат курсу, поэтому право на них — это право на сам курс.
  static canManageLessons(course: Course, userId: number) {
    return course.creatorId === userId;
  }
}
