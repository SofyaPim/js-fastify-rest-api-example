/** biome-ignore-all lint/complexity/noStaticOnlyClass: - */

import type { CourseLessonInsert, DrizzleDB } from '../../types/index.ts'
import { object, parseAsync, string } from 'valibot'

const schema = object({
  name: string(),
  body: string(),
})

class LessonValidator {
  static validate(_db: DrizzleDB, data: CourseLessonInsert) {
    return parseAsync(schema, data)
  }
}

export default LessonValidator
