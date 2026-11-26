import { isNewerVersion, parseVersion } from "@/features/updater/version";

/** 마지막으로 본 앱 버전을 담는 저장 키 (기기마다 따로 본다) */
export const LAST_SEEN_KEY = "cetusnote.lastSeenVersion";
/** 업데이트 설치를 끝내고 다시 열기 전에 적어 두는 「이 버전 노트를 띄울 것」 표식 */
export const PENDING_KEY = "cetusnote.pendingWhatsNew";

export type WhatsNewDecision = {
  /** 「업데이트 내용」 대화상자를 지금 띄울지 */
  show: boolean;
  /** 저장해 둘 「마지막으로 본 버전」 (null이면 그대로 둔다) */
  record: string | null;
  /** 표식을 지울지 (있었으면 지운다) */
  clearPending: boolean;
};

/**
 * 앱을 켤 때 한 번 판단한다 (SYS-12).
 * - 업데이트로 방금 바뀐 버전(표식 pending === current)이면 띄운다. 처음 설치와 구분하는 기준이다
 * - 저장된 「마지막으로 본 버전」보다 새 버전이어도 띄운다(표식 없이 직접 설치한 경우)
 * - 처음 실행(기록 없음)·같은 버전·낮은 버전은 띄우지 않는다
 * - 노트 섹션이 없는 버전은 띄우지 않는다(hasNotes)
 * 띄우기로 정하면 기록을 바로 갱신해 같은 버전이 다시 뜨지 않게 한다.
 */
export function decideWhatsNew(input: {
  lastSeen: string | null;
  pending: string | null;
  current: string | null;
  hasNotes: boolean;
}): WhatsNewDecision {
  const { lastSeen, pending, current, hasNotes } = input;
  const clearPending = pending !== null;
  if (!current || !parseVersion(current)) return { show: false, record: null, clearPending };
  const fromUpdate = pending === current;
  const newerThanSeen =
    lastSeen !== null && lastSeen !== current && isNewerVersion(current, lastSeen);
  const show = hasNotes && (fromUpdate || newerThanSeen);
  const record = lastSeen === current ? null : current;
  return { show, record, clearPending };
}

/** 이 기기의 설정 저장소(localStorage). 막혀 있으면(사생활 보호 모드 등) null */
export function devicePrefs(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 저장소가 막혀 있으면 기록이 없는 것으로 본다 */
export function readItem(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(storage: Storage | null, key: string, value: string | null): void {
  if (!storage) return;
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // 기록하지 못해도 앱은 계속 돈다. 다음 실행에 다시 판단할 뿐이다
  }
}
