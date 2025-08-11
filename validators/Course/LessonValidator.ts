/** biome-ignore-all lint/complexity/noStaticOnlyClass: - */

import vine from '@vinejs/vine';
import type { CourseLessonInsert, DrizzleDB } from '../../types/index.ts';

const schema = vine.object({}).allowUnknownProperties();
const validator = vine.compile(schema);

class LessonValidator {
  static validate(db: DrizzleDB, data: CourseLessonInsert) {
    return validator.validate(data, { meta: { db } });
  }
}

export default LessonValidator;
