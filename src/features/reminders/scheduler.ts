import { formatDateTimeLabel } from "../../lib/dates/date-label";
import type { DateReminder } from "../../lib/dates/collect-reminders";
import { computeReminderAt } from "../../lib/dates/reminder";

/**
 * 날짜 칩 알림 스케줄러 (EDIT-37, ADR-025 알림 항목).
 *
 * - 앱이 켜져 있을 때만 동작한다. 꺼져 있던 동안 지난 알림은 다음 실행 때 앱 안에서 보여 준다(`onMissed`).
 * - 시계는 한 개의 타이머로 돈다. 다음 알림 시각과 60초 중 이른 쪽에 깨어나므로, 잠자기에서 깨어나도 밀린 알림을 바로 처리한다.
 * - 같은 알림은 한 번만 보낸다. 보냈다는 표시(`fired`)는 저장소에 남아 다음 실행에도 이어진다.
 * - 권한이 없거나 OS 알림이 실패하면 앱 안 알림(`onFallback`)으로 대신한다.
 *
 * 순수 로직만 둔다. OS 알림·저장소·타이머는 deps로 받아 테스트에서 바꾼다.
 */

export type PermissionState = "granted" | "default" | "denied" | "unsupported";

export type ReminderNotification = {
  pageId: string;
  /** 알림 제목: 페이지 제목 */
  title: string;
  /** 알림 본문: 날짜 표시 (예: 「내일 14:30」) */
  body: string;
};

export type MissedReminder = {
  key: string;
  pageId: string;
  title: string;
  label: string;
  at: Date;
};

/** 보낸 알림 목록. 저장소에 남아 다음 실행에도 중복을 막는다 */
export type FiredStore = {
  has(key: string): boolean;
  add(key: string): void;
};

export type ReminderSchedulerDeps = {
  now(): Date;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  permission(): Promise<PermissionState>;
  send(n: ReminderNotification): Promise<"sent" | "failed">;
  fired: FiredStore;
  pageTitle(pageId: string): string;
  /** 권한이 필요하면 한 번 알린다. UI가 설명과 「허용」 버튼을 보여 주고 권한을 요청한다 */
  onPermissionNeeded?(): void;
  /** OS 알림을 보내지 못했을 때 앱 안에서 알린다 */
  onFallback?(items: MissedReminder[]): void;
  /** 앱이 꺼져 있던 동안 지난 알림(앱을 켰을 때 한 번씩) */
  onMissed?(items: MissedReminder[]): void;
};

/** 타이머는 최대 이 간격으로 깨어난다 (잠자기·시계 변경 뒤의 밀림을 줄인다) */
export const TICK_MS = 60_000;
/** 이보다 오래 지난 알림은 놓친 목록에 올리지 않고 조용히 보낸 것으로 표시한다 */
export const MISSED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** 알림 식별 키. 페이지·날짜·시각·규칙이 같으면 같은 알림이다 */
export function reminderKey(r: DateReminder): string {
  return [r.pageId, r.date, r.time ?? "", JSON.stringify(r.rule)].join("|");
}

type Pending = { key: string; at: Date; item: DateReminder };

export class ReminderScheduler {
  /** 페이지 id → 그 페이지의 알림 목록 (페이지를 저장할 때마다 바뀐다) */
  private readonly byPage = new Map<string, DateReminder[]>();
  /** 이번 실행 중 예약된(아직 울리지 않은) 알림 */
  private readonly pending = new Map<string, Pending>();
  private timer: unknown = null;
  private readonly launchedAt: number;
  private askedPermission = false;

  constructor(private readonly deps: ReminderSchedulerDeps) {
    this.launchedAt = deps.now().getTime();
  }

  /** 한 페이지의 알림 목록을 바꾼다. 빈 목록이면 그 페이지를 뺀다 */
  setPage(pageId: string, items: DateReminder[]): void {
    if (items.length > 0) this.byPage.set(pageId, items);
    else this.byPage.delete(pageId);
    this.refresh();
  }

  removePage(pageId: string): void {
    this.setPage(pageId, []);
  }

  /** 워크스페이스를 바꿀 때: 예약을 모두 지운다 */
  reset(): void {
    this.byPage.clear();
    this.pending.clear();
    this.stopTimer();
  }

  /** 화면이 다시 보이거나 창에 포커스가 올 때 호출: 밀린 알림을 바로 처리한다 */
  wake(): void {
    this.refresh();
  }

  dispose(): void {
    this.reset();
  }

  private refresh(): void {
    const now = this.deps.now();
    const nowMs = now.getTime();
    const live = new Map<string, DateReminder>();
    for (const item of [...this.byPage.values()].flat()) {
      if (item.done) continue;
      const key = reminderKey(item);
      if (live.has(key)) continue;
      live.set(key, item);
    }
    // 목록에서 사라졌거나 완료된 예약은 취소한다
    for (const key of [...this.pending.keys()]) if (!live.has(key)) this.pending.delete(key);

    const missed: MissedReminder[] = [];
    for (const [key, item] of live) {
      if (this.deps.fired.has(key)) continue;
      const at = computeReminderAt(item.date, item.time, item.rule);
      if (!at) continue;
      if (this.pending.has(key)) continue;
      if (at.getTime() > nowMs) {
        this.pending.set(key, { key, at, item });
        this.askPermissionOnce();
        continue;
      }
      // 처음 보는데 이미 지났다: 앱이 꺼져 있던 동안 놓친 알림이면 목록에 올리고, 방금 정한 과거 시각이면 조용히 넘긴다
      this.deps.fired.add(key);
      const recent = nowMs - at.getTime() <= MISSED_WINDOW_MS;
      if (recent && at.getTime() < this.launchedAt) missed.push(this.toMissed(key, item, at));
    }
    if (missed.length > 0) this.deps.onMissed?.(missed);

    // 시각이 된 예약을 보낸다
    for (const p of [...this.pending.values()]) {
      if (p.at.getTime() > nowMs) continue;
      this.pending.delete(p.key);
      this.fire(p, now);
    }
    this.scheduleTick(nowMs);
  }

  private scheduleTick(nowMs: number): void {
    this.stopTimer();
    if (this.pending.size === 0) return;
    let next = Infinity;
    for (const p of this.pending.values()) next = Math.min(next, p.at.getTime());
    const delay = Math.max(0, Math.min(next - nowMs, TICK_MS));
    this.timer = this.deps.setTimer(() => this.refresh(), delay);
  }

  private stopTimer(): void {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  private fire(p: Pending, now: Date): void {
    // 먼저 보낸 표시를 남겨 두 번 울리지 않게 한다
    this.deps.fired.add(p.key);
    const title = this.deps.pageTitle(p.item.pageId).trim() || "제목 없음";
    const body = formatDateTimeLabel(p.item.date, p.item.time, now);
    void this.deliver(p, { pageId: p.item.pageId, title, body });
  }

  private async deliver(p: Pending, n: ReminderNotification): Promise<void> {
    const perm = await this.deps.permission();
    if (perm === "granted") {
      const result = await this.deps.send(n).catch(() => "failed" as const);
      if (result === "sent") return;
    }
    this.deps.onFallback?.([this.toMissed(p.key, p.item, p.at)]);
  }

  private askPermissionOnce(): void {
    if (this.askedPermission || !this.deps.onPermissionNeeded) return;
    this.askedPermission = true;
    void this.deps.permission().then((perm) => {
      if (perm === "default") this.deps.onPermissionNeeded?.();
    });
  }

  private toMissed(key: string, item: DateReminder, at: Date): MissedReminder {
    return {
      key,
      pageId: item.pageId,
      title: this.deps.pageTitle(item.pageId).trim() || "제목 없음",
      label: formatDateTimeLabel(item.date, item.time, at),
      at,
    };
  }
}
