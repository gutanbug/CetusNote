import type { FiredStore } from "./scheduler";

/** 보낸 알림 키를 저장하는 곳. 앱 설정이 아니라 이 기기의 작은 기억이라 localStorage를 쓴다 (실패해도 동작은 계속한다) */
export const FIRED_STORAGE_KEY = "cetusnote.reminders.fired";
/** 이보다 많이 쌓이면 가장 오래된 것부터 버린다 */
export const FIRED_MAX = 2000;

/**
 * 메모리 집합 + 저장소 백업. read·write는 실패할 수 있으므로 호출 쪽이 감싸지 않아도 되게 여기서 삼킨다.
 */
export function createFiredStore(
  read: () => string | null = readLocal,
  write: (value: string) => void = writeLocal,
): FiredStore {
  let order: string[] = [];
  try {
    const raw = read();
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) order = parsed.filter((k): k is string => typeof k === "string");
  } catch {
    order = [];
  }
  const set = new Set(order);
  return {
    has: (key) => set.has(key),
    add: (key) => {
      if (set.has(key)) return;
      set.add(key);
      order.push(key);
      if (order.length > FIRED_MAX) {
        const drop = order.splice(0, order.length - FIRED_MAX);
        for (const k of drop) set.delete(k);
      }
      try {
        write(JSON.stringify(order));
      } catch {
        // 저장 실패는 이번 실행 동안만 중복을 막는다
      }
    },
  };
}

function readLocal(): string | null {
  try {
    return globalThis.localStorage?.getItem(FIRED_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeLocal(value: string): void {
  globalThis.localStorage?.setItem(FIRED_STORAGE_KEY, value);
}
