import openapiConst from '../tsp-output/@typespec/openapi3/openapi.v2.json' with { type: 'json' }

export function getPagingOptions(page: number, perPage = 10) {
  return {
    limit: perPage,
    offset: (page - 1) * perPage,
  }
}

export function openapi() {
  return openapiConst
}
