import vine from '@vinejs/vine'

const schema = vine.object({
}).allowUnknownProperties()
const validator = vine.compile(schema)

class LessonValidator {
  /**
   * @param {import('../../types/index.ts').DrizzleDB} db
   * @param {Partial<import('../../types/index.ts').CourseLesson>} data
   */
  static validate(db, data) {
    return validator.validate(data, { meta: { db } })
  }
}

export default LessonValidator
