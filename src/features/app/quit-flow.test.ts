import { describe, expect, it, vi } from "vitest";
import { runQuitFlow } from "./lifecycle";

type Notice = { message: string; action?: { label: string; onClick: () => void } };

function setup(saved: boolean | Error, confirm = vi.fn(async () => {})) {
  const notices: Notice[] = [];
  const saveAll = vi.fn(async () => {
    if (saved instanceof Error) throw saved;
    return saved;
  });
  const notify = vi.fn((message: string, action?: Notice["action"]) => {
    notices.push({ message, action });
  });
  return {
    saveAll,
    confirm,
    notify,
    notices,
    run: () => runQuitFlow({ saveAll, confirmQuit: confirm, notify }),
  };
}

describe("runQuitFlow (DATA-07)", () => {
  it("저장이 끝나면 저장을 기다린 뒤 종료를 확인한다", async () => {
    const order: string[] = [];
    const saveAll = vi.fn(async () => {
      order.push("save");
      return true;
    });
    const confirm = vi.fn(async () => {
      order.push("confirm");
    });
    const quit = await runQuitFlow({ saveAll, confirmQuit: confirm, notify: vi.fn() });
    expect(quit).toBe(true);
    expect(order).toEqual(["save", "confirm"]);
  });

  it("저장에 실패하면 종료하지 않고 「그래도 종료」를 준다", async () => {
    const t = setup(false);
    const quit = await t.run();
    expect(quit).toBe(false);
    expect(t.confirm).not.toHaveBeenCalled();
    expect(t.notices).toHaveLength(1);
    expect(t.notices[0]!.message).toBe("저장하지 못한 변경이 있어요. 앱을 종료하지 않았어요.");
    expect(t.notices[0]!.action?.label).toBe("그래도 종료");
  });

  it("「그래도 종료」를 누르면 저장 없이 종료를 확인한다", async () => {
    const t = setup(false);
    await t.run();
    t.notices[0]!.action!.onClick();
    await vi.waitFor(() => expect(t.confirm).toHaveBeenCalledTimes(1));
  });

  it("저장 함수가 던져도 저장 실패로 본다", async () => {
    const t = setup(new Error("disk"));
    expect(await t.run()).toBe(false);
    expect(t.confirm).not.toHaveBeenCalled();
    expect(t.notices[0]!.action?.label).toBe("그래도 종료");
  });

  it("종료 확인이 실패하면 알린다", async () => {
    const t = setup(
      true,
      vi.fn(async () => Promise.reject(new Error("permission"))),
    );
    await t.run();
    expect(t.notices).toEqual([{ message: "앱을 종료하지 못했어요. 다시 시도해 주세요." }]);
  });
});
