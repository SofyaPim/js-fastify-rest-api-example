/** biome-ignore-all lint/complexity/noStaticOnlyClass: - */

import vine from '@vinejs/vine';
import type { CourseInsert, DrizzleDB } from '../types/index.ts';

const schema = vine
  .object({
    // name: vine.string(),
    // description: vine.string(),
  })
  .allowUnknownProperties();
const validator = vine.compile(schema);

class CourseValidator {
  static validate(db: DrizzleDB, data: CourseInsert) {
    return validator.validate(data, { meta: { db } });
  }
}

export default CourseValidator;
