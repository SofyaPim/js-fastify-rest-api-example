# js-fastify-rest-api-example

REST API на [Fastify](https://fastify.dev/), собранный «по-взрослому»:
схема API описана отдельно от кода, база через ORM, валидация по схеме.

## Зачем это нужно

Пример того, как выглядит API-проект, когда он перерастает один файл с
маршрутами. Отличия от учебной заглушки видны сразу:

- **Контракт первичен.** API описан на [TypeSpec](https://typespec.io/)
  в `main.tsp`, из него генерируется OpenAPI, а из OpenAPI — типы для кода.
  Документация не расходится с реализацией, потому что порождена из одного
  источника.
- **Одна спека проверяет код дважды.** Из OpenAPI генерируются типы
  обработчиков и zod-схемы ([hey-api](https://heyapi.dev/)): первое проверяет
  `tsc` статически, второе — валидаторы в рантайме. Сами маршруты по этой же
  спеке регистрирует `fastify-openapi-glue`, поэтому таблица маршрутов и
  проверка запросов тоже не пишутся руками. `make generate-check` в CI не даёт
  сгенерированному разойтись со спекой.
- **База через [Drizzle](https://orm.drizzle.team/)**: схема в `db/schema.ts`,
  миграции генерируются по ней.
- **Валидация входа** отдельным слоем в `validators/`, а не внутри обработчика.

## Запуск

```bash
make install
make dev
make test
```

Полезное:

```bash
make routes             # список маршрутов
make migration-generate # миграция по изменённой схеме
make generate-types     # OpenAPI и типы из TypeSpec
make generate-check     # проверить, что сгенерированное закоммичено
make mock               # поднять мок-сервер по OpenAPI
```

---

[![Hexlet Ltd. logo](https://raw.githubusercontent.com/Hexlet/assets/master/images/hexlet_logo128.png)](https://hexlet.io/?utm_source=github&utm_medium=link&utm_campaign=js-fastify-rest-api-example)

This repository is created and maintained by the team and the community of Hexlet, an educational project. [Read more about Hexlet](https://hexlet.io/?utm_source=github&utm_medium=link&utm_campaign=js-fastify-rest-api-example).

See most active contributors on [hexlet-friends](https://friends.hexlet.io/).
