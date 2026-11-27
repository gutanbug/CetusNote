/** 저장 계층(lib/storage)이 프론트엔드에서 만드는 오류 문구 (SYS-14) */
export const storage = {
  noWorkspace: "워크스페이스가 열려 있지 않아요",
  schema: {
    notObject: "페이지가 객체가 아니에요",
    newerPage: (version: number) => `더 새 버전(${version})의 앱에서 만든 페이지예요`,
    noMigration: (version: number) => `버전 ${version} 마이그레이션이 없어요`,
    invalidId: "페이지 id가 올바르지 않아요",
    newerWorkspace: (version: number) => `더 새 버전(${version})의 앱에서 만든 워크스페이스예요`,
  },
};
