import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { summaryIndex, summarizePage } from "@/features/pages/summary";
import { getStorage } from "@/lib/storage/default";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startReminderAlerts } from "./reminder-alerts";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({
  toast,
  Toaster: () => null,
  ToastCancelButton: () => null,
}));

// 노드 환경: 깨우기 신호(창 포커스·화면 보임)만 받을 자리를 준다
const noop = () => undefined;
vi.stubGlobal("document", {
  visibilityState: "visible",
  addEventListener: noop,
  removeEventListener: noop,
});
vi.stubGlobal("window", { addEventListener: noop, removeEventListener: noop });

beforeAll(async () => {
  await getStorage().openDefaultWorkspace();
  await pagesStore.getState().load();
  await metaStore.getState().load();
});

/** 날짜 칩 한 개짜리 본문의 요약을 만든다 (본문을 읽지 않고 요약만 넣는다) */
function remind(pageId: string, time: string, done = false) {
  const content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "dateChip",
            attrs: { date: "2026-11-24", time: null, reminder: { kind: "custom", time }, done },
          },
        ],
      },
    ],
  } as never;
  // 저장한 것과 같은 본문을 스토어에도 넣는다 (백그라운드 요약이 스토어의 본문으로 다시 뽑아도 같아야 한다)
  pagesStore.getState().update(pageId, { content });
  summaryIndex.setMany([[pageId, summarizePage({ id: pageId, content })]]);
}

/** 이 테스트에서 만든 페이지 제목이 든 토스트 호출 */
const callsFor = (title: string) => toast.mock.calls.filter((c) => String(c[0]).includes(title));

let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-24T10:00:00") });
  toast.mockClear();
  stop = startReminderAlerts();
});

afterEach(() => {
  stop?.();
  summaryIndex.clear();
  vi.useRealTimers();
});

describe("날짜 알림 화면 연결 (EDIT-37)", () => {
  it("시각이 되면 알림을 보내지 못했을 때의 앱 안 알림을 「열기」와 함께 띄운다", async () => {
    const page = pagesStore.getState().create({ title: "회의 알림A" });
    remind(page.id, "10:02");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(callsFor("회의 알림A")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60_000);
    const [call] = callsFor("회의 알림A");
    expect(call).toBeTruthy();
    expect((call![1] as { action: { label: string } }).action.label).toBe("열기");
  });

  it("저장으로 시각이 바뀌면 새 시각에 맞춰 다시 예약한다", async () => {
    const page = pagesStore.getState().create({ title: "회의 알림B" });
    remind(page.id, "10:02");
    remind(page.id, "10:05");
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(callsFor("회의 알림B")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(callsFor("회의 알림B")).toHaveLength(1);
  });

  it("앱을 켜기 전에 고쳐 둔 지난 알림은 「놓친 알림」 한 번으로 알린다", async () => {
    stop?.();
    // 앱을 끄기 전(08:00)에 고쳐 둔 페이지 → 10:00에 켜면 09:30 알림은 놓친 것이다
    vi.setSystemTime(new Date("2026-11-24T08:00:00"));
    const page = pagesStore.getState().create({ title: "회의 알림C" });
    remind(page.id, "09:30");
    vi.setSystemTime(new Date("2026-11-24T10:00:00"));
    stop = startReminderAlerts();
    await vi.advanceTimersByTimeAsync(0);
    const missed = toast.mock.calls.filter((c) => String(c[0]).startsWith("놓친 알림"));
    expect(missed).toHaveLength(1);
    expect(callsFor("회의 알림C")).toHaveLength(0);
  });

  it("앱을 켠 뒤 정한 지난 시각은 놓친 알림으로 치지 않는다", async () => {
    const page = pagesStore.getState().create({ title: "회의 알림G" });
    remind(page.id, "09:00");
    await vi.advanceTimersByTimeAsync(0);
    expect(toast.mock.calls.filter((c) => String(c[0]).startsWith("놓친 알림"))).toHaveLength(0);
  });

  it("휴지통에 넣은 페이지는 알림을 빼고, 완료한 칩은 울리지 않는다", async () => {
    const trashed = pagesStore.getState().create({ title: "회의 알림D" });
    remind(trashed.id, "10:01");
    pagesStore.getState().trash(trashed.id);
    const done = pagesStore.getState().create({ title: "회의 알림E" });
    remind(done.id, "10:01", true);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(callsFor("회의 알림D")).toHaveLength(0);
    expect(callsFor("회의 알림E")).toHaveLength(0);
  });

  it("워크스페이스를 바꾸면 예약을 모두 지운다", async () => {
    const page = pagesStore.getState().create({ title: "회의 알림F" });
    remind(page.id, "10:01");
    // 다른 워크스페이스로 바뀌면 페이지와 요약이 모두 새로 읽힌다 (검색 색인이 요약을 비운다)
    const next = pagesStore.getState().loadSeq + 1;
    summaryIndex.clear();
    pagesStore.setState({ pages: {}, structure: {}, loadSeq: next });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(toast).not.toHaveBeenCalled();
  });
});
