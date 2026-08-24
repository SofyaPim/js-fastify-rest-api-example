import { zCourseLessonCreateDto, zCourseLessonEditDto } from "../../types/handlers/v1/zod.gen.ts";
import type { DrizzleDB } from "../../types/index.ts";

class LessonValidator {
  static validateCreate(_db: DrizzleDB, data: unknown) {
    return zCourseLessonCreateDto.parseAsync(data);
  }

  static validateEdit(_db: DrizzleDB, data: unknown) {
    return zCourseLessonEditDto.parseAsync(data);
  }
}

export default LessonValidator;
