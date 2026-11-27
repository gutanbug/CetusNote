import { setTrayStatus } from "@/lib/storage/window";
import { remindersStore } from "./index";
import { remaining, type Reminder } from "./model";

/** 메뉴 막대에 보일 타이머 글자 (SYS-16). 1시간 미만은 mm:ss, 그 이상은 h:mm:ss */
export function formatTrayTimer(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 아직 끝나지 않은 타이머 가운데 가장 먼저 끝나는 것의 남은 초. 없으면 null */
export function nearestTimerLeft(list: readonly Reminder[], now: Date): number | null {
  let best: number | null = null;
  for (const rem of list) {
    if (rem.done) continue;
    const left = remaining(rem, now);
    if (left === null || left <= 0) continue;
    if (best === null || left < best) best = left;
  }
  return best;
}

export interface TrayTimerDeps {
  list(): readonly Reminder[];
  now(): Date;
  send(text: string | null): Promise<void>;
}

const defaultDeps: TrayTimerDeps = {
  list: () => remindersStore.getState().list,
  now: () => new Date(),
  send: setTrayStatus,
};

/**
 * 메뉴 막대 타이머 표시를 1초마다 맞춘다 (메인 창에서만 돈다). 달리는 타이머가 없으면 글자를 지운다.
 * 글자가 바뀔 때만 Rust에 보낸다. 돌려주는 함수로 멈춘다.
 */
export function startTrayTimerStatus(deps: TrayTimerDeps = defaultDeps): () => void {
  let shown: string | null | undefined;
  const tick = () => {
    const left = nearestTimerLeft(deps.list(), deps.now());
    const text = left === null ? null : formatTrayTimer(left);
    if (text === shown) return;
    shown = text;
    deps.send(text).catch(() => undefined);
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
