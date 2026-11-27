import { msg } from "@/lib/i18n";
import type { OsNotification } from "../../lib/storage/notification";
import { reminderFireKey } from "./due";
import { formatReminderWhen } from "./present";
import { dueAt, nextOccurrence, type Reminder } from "./model";
import { MISSED_WINDOW_MS, TICK_MS, type FiredStore, type PermissionState } from "./scheduler";

/**
 * 알림 목록(SYS-16) 스케줄러. 날짜 칩 스케줄러(scheduler.ts)와 같은 규칙을 쓴다.
 *
 * - 울릴 시각(`dueAt`: 미루기 → 타이머 끝 → 알람 시각)에 한 번 보낸다. 키는 `reminderFireKey`.
 * - 앱이 꺼져 있던 동안 지난 알림은 `onMissed`로 한 번 알린다. 반복 알림은 놓친 울림 중 가장 최근 것만 보인다.
 *   (목록은 `at`을 그대로 두므로, 완료하면 `complete`가 최근 시각 다음 울림으로 넘긴다)
 * - 권한이 없거나 OS 알림이 실패하면 `onFallback`으로 앱 안에서 알린다. 행동 버튼은 그 대화상자가 맡는다.
 * 순수 로직만 둔다. 타이머·권한·OS 알림·저장은 deps로 받는다.
 */

export type StoreDue = {
  key: string;
  rem: Reminder;
  /** 제목: 알림 이름, 없으면 「알림」 */
  title: string;
  /** 시각 문구 (formatReminderWhen) */
  when: string;
  /** 놓친 알림일 때 울렸어야 할 가장 최근 시각 */
  at: Date;
};

export type StoreSchedulerDeps = {
  now(): Date;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  permission(): Promise<PermissionState>;
  send(n: OsNotification): Promise<"sent" | "failed">;
  fired: FiredStore;
  /** OS 알림을 보내지 못했을 때 앱 안에서 알린다 */
  onFallback?(items: StoreDue[]): void;
  /** 메인 창이 떠 있어 사용자가 보고 있을 때 울린 알림. 있으면 OS 알림 대신 이것을 부른다 */
  isFocused?(): boolean;
  onFocused?(items: StoreDue[]): void;
  /** 앱이 꺼져 있던 동안 지난 알림 (한 번씩) */
  onMissed?(items: StoreDue[]): void;
};

/** 울린 적 없는 시각까지 지났는지 확인할 때 가장 최근 울림을 찾는 상한(반복 횟수) */
const MAX_STEPS = 2000;

/** 놓친 반복 알림의 가장 최근 울림 시각 (없으면 due 자체) */
function latestOccurrence(rem: Reminder, due: Date, now: Date): Date {
  if (!rem.repeat) return due;
  let cur = due;
  for (let i = 0; i < MAX_STEPS; i++) {
    const next = nextOccurrence(rem, cur);
    if (!next || next.getTime() > now.getTime()) break;
    cur = next;
  }
  return cur;
}

export class StoreReminderScheduler {
  private list: Reminder[] = [];
  private timer: unknown = null;
  private readonly launchedAt: number;

  constructor(private readonly deps: StoreSchedulerDeps) {
    this.launchedAt = deps.now().getTime();
  }

  /** 목록이 바뀌었을 때(불러오기·추가·완료 등) 호출 */
  setList(list: readonly Reminder[]): void {
    this.list = [...list];
    this.refresh();
  }

  /** 화면이 다시 보이거나 포커스를 얻을 때: 밀린 알림을 바로 처리한다 */
  wake(): void {
    this.refresh();
  }

  dispose(): void {
    this.list = [];
    this.stopTimer();
  }

  private refresh(): void {
    const now = this.deps.now();
    const nowMs = now.getTime();
    let nextMs = Infinity;
    const missed: StoreDue[] = [];
    const fire: StoreDue[] = [];

    for (const rem of this.list) {
      if (rem.done) continue;
      const due = dueAt(rem);
      const key = reminderFireKey(rem);
      if (!due || !key) continue;
      if (this.deps.fired.has(key)) continue;
      if (due.getTime() > nowMs) {
        nextMs = Math.min(nextMs, due.getTime());
        continue;
      }
      this.deps.fired.add(key);
      const created = Date.parse(rem.createdAt);
      const isOld = Number.isFinite(created) && created < this.launchedAt;
      const recent = nowMs - due.getTime() <= MISSED_WINDOW_MS;
      if (due.getTime() < this.launchedAt && isOld && recent) {
        missed.push(this.toDue(key, rem, latestOccurrence(rem, due, now), now));
      } else {
        fire.push(this.toDue(key, rem, due, now));
      }
    }

    if (missed.length > 0) this.deps.onMissed?.(missed);
    for (const item of fire) void this.deliver(item);
    this.scheduleTick(nextMs, nowMs);
  }

  private scheduleTick(nextMs: number, nowMs: number): void {
    this.stopTimer();
    if (!Number.isFinite(nextMs)) return;
    const delay = Math.max(0, Math.min(nextMs - nowMs, TICK_MS));
    this.timer = this.deps.setTimer(() => this.refresh(), delay);
  }

  private stopTimer(): void {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  private async deliver(item: StoreDue): Promise<void> {
    // 보고 있는 창에는 OS 알림 대신 앱 안 대화상자(미루기·완료·열기)를 올린다
    if (this.deps.isFocused?.() && this.deps.onFocused) {
      this.deps.onFocused([item]);
      return;
    }
    const perm = await this.deps.permission();
    if (perm === "granted") {
      const result = await this.deps
        .send({ title: item.title, body: item.when })
        .catch(() => "failed" as const);
      if (result === "sent") return;
    }
    this.deps.onFallback?.([item]);
  }

  private toDue(key: string, rem: Reminder, at: Date, now: Date): StoreDue {
    return {
      key,
      rem,
      title: rem.label.trim() || msg().features.reminders.notifyTitle,
      when: formatReminderWhen(rem, now),
      at,
    };
  }
}
