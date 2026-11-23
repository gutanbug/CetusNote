import type { UpdateInfo, Updater } from "./types";

export type FakeUpdaterOptions = {
  current?: string;
  /** 서버가 알려 줄 최신 버전. null이면 최신 상태 */
  latest?: UpdateInfo | null;
  /** 지정하면 check()가 이 메시지로 실패한다 */
  checkError?: string;
  /** 지정하면 내려받기가 끝난 뒤 이 메시지로 실패한다 */
  installError?: string;
  /** 지정하면 설치는 끝났는데 앱을 다시 여는 단계(relaunch)가 이 메시지로 실패한다 */
  relaunchError?: string;
  /** 진행률을 나눌 단계 수 (기본 4) */
  steps?: number;
  /** 단계 사이 지연(ms). 미리보기에서 진행 표시를 보이게 할 때만 쓴다 */
  delayMs?: number;
};

/** 브라우저 미리보기·테스트용 가짜 업데이트. 실제 네트워크·설치는 하지 않는다 */
export function createFakeUpdater(options: FakeUpdaterOptions = {}): Updater & {
  readonly relaunched: boolean;
} {
  const o = { current: "0.1.0", latest: null, steps: 4, delayMs: 0, ...options };
  let relaunched = false;
  const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : undefined);
  return {
    get relaunched() {
      return relaunched;
    },
    async currentVersion() {
      return o.current;
    },
    async check() {
      if (o.checkError) throw new Error(o.checkError);
      return o.latest;
    },
    async downloadAndInstall(onProgress) {
      if (!o.latest) throw new Error("확인된 업데이트가 없어요");
      for (let i = 1; i <= o.steps; i++) {
        await wait(o.delayMs);
        onProgress(Math.round((i / o.steps) * 100));
      }
      if (o.installError) throw new Error(o.installError);
    },
    async relaunch() {
      if (o.relaunchError) throw new Error(o.relaunchError);
      relaunched = true;
    },
  };
}
