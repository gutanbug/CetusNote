/**
 * 저장 계층 진입점. 프론트엔드에서 파일을 다루는 곳은 여기뿐이다(ADR-002).
 * components는 이 모듈을 import하지 않는다 — features/screens가 불러 props로 넘긴다.
 */
export * from "./types";
export {
  canContain,
  COLOR_NAMES,
  createPage,
  DEFAULT_STATUSES,
  normalizeCollection,
  normalizePage,
  normalizeWorkspace,
  PAGE_SCHEMA_VERSION,
  SchemaError,
  STATUS_MAX,
  WORKSPACE_SCHEMA_VERSION,
  BUILTIN_PROPERTIES,
  FIELD_NAME_MAX,
  FIELD_TEXT_MAX,
  FIELD_TYPES,
  FIELDS_MAX,
  isFieldId,
} from "./schema";
export { isValidId, ulid } from "./ulid";
export { createMemoryStorage } from "./memory";
export { createTauriStorage } from "./tauri";
