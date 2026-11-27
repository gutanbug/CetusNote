import { msg } from "@/lib/i18n";
import { useEffect } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { toast } from "@/components/ui/toast";
import { updaterStore } from "@/features/updater";
import { CHANGELOG_TEXT, extractSection } from "./changelog";
import {
  decideWhatsNew,
  devicePrefs,
  LAST_SEEN_KEY,
  PENDING_KEY,
  readItem,
  writeItem,
} from "./seen";

export { CHANGELOG_TEXT, extractSection, parseBlocks, parseInline } from "./changelog";
export type { Block, Inline } from "./changelog";
export { releaseUrl, RELEASE_REPO } from "./release-url";

/** 「업데이트 내용」 대화상자 상태. version이 null이면 닫혀 있다 (SYS-12) */
export const whatsNewStore = createStore<{
  version: string | null;
  open(version: string): void;
  close(): void;
}>()((set) => ({
  version: null,
  open: (version) => set({ version }),
  close: () => set({ version: null }),
}));

export function useWhatsNew<T>(select: (s: { version: string | null }) => T): T {
  return useStore(whatsNewStore, select);
}

let startupChecked = false;

/**
 * 앱을 켤 때 한 번 본다. 업데이트로 방금 바뀐 버전이거나 새 버전이면 대화상자를 띄운다(SYS-12).
 * 처음 설치는 띄우지 않고 버전만 기록한다.
 */
export async function checkWhatsNewOnStart(): Promise<void> {
  if (startupChecked) return;
  startupChecked = true;
  await updaterStore
    .getState()
    .loadVersion()
    .catch(() => undefined);
  const current = updaterStore.getState().currentVersion;
  const storage = devicePrefs();
  const decision = decideWhatsNew({
    lastSeen: readItem(storage, LAST_SEEN_KEY),
    pending: readItem(storage, PENDING_KEY),
    current,
    hasNotes: current !== null && extractSection(CHANGELOG_TEXT, current) !== null,
  });
  if (decision.clearPending) writeItem(storage, PENDING_KEY, null);
  if (decision.record) writeItem(storage, LAST_SEEN_KEY, decision.record);
  if (decision.show && current) whatsNewStore.getState().open(current);
}

/**
 * 설치가 끝난 순간(다시 열기 직전)을 표식으로 남긴다. 다음 실행이 이 표식으로 「업데이트 직후」를 안다.
 * 설치가 실패하면 finishing이 켜지지 않으므로 표식도 남지 않는다.
 */
export function watchUpdateInstall(): () => void {
  let finishing = updaterStore.getState().finishing;
  return updaterStore.subscribe((s) => {
    if (s.finishing && !finishing && s.update) {
      writeItem(devicePrefs(), PENDING_KEY, s.update.version);
    }
    finishing = s.finishing;
  });
}

/** 「릴리스 노트 보기」(설정 · ⌘K): 지금 버전의 노트를 연다. 노트가 없으면 토스트로 알린다 */
export async function openWhatsNewForCurrent(): Promise<void> {
  await updaterStore
    .getState()
    .loadVersion()
    .catch(() => undefined);
  const current = updaterStore.getState().currentVersion;
  if (!current || extractSection(CHANGELOG_TEXT, current) === null) {
    toast(msg().features.releaseNotes.missing(current ?? null));
    return;
  }
  whatsNewStore.getState().open(current);
}

/** App에서 워크스페이스가 준비되면 한 번 호출한다 */
export function useWhatsNewOnStart(ready: boolean) {
  useEffect(() => watchUpdateInstall(), []);
  useEffect(() => {
    if (ready) void checkWhatsNewOnStart();
  }, [ready]);
}
