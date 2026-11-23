/** 새 버전 정보 (SYS-07). 릴리스 latest.json에서 온다 */
export type UpdateInfo = {
  version: string;
  notes: string | null;
  date: string | null;
};

/**
 * 앱 업데이트 경계. 화면·기능은 이 인터페이스만 쓴다(@tauri-apps/* 직접 import 금지).
 * Tauri 창에서는 tauri.ts, 브라우저 미리보기와 테스트에서는 fake.ts가 맡는다.
 */
export type Updater = {
  /** 설치된 앱 버전 */
  currentVersion(): Promise<string>;
  /** 새 버전이 있으면 정보를, 없으면 null. 내려받지는 않는다 */
  check(): Promise<UpdateInfo | null>;
  /** 마지막 check()가 찾은 업데이트를 내려받아 설치한다. 진행률은 0–100, 모르면 null */
  downloadAndInstall(onProgress: (percent: number | null) => void): Promise<void>;
  /** 설치가 끝난 뒤 앱을 다시 연다 */
  relaunch(): Promise<void>;
};
