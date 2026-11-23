import { describe, expect, it } from "vitest";
import { loadWorkspaceInOrder } from "./open-order";

/** 직접 풀 수 있는 약속 — 앞 단계가 끝나기 전에 뒷 단계가 시작되는지 본다 */
function gate() {
  let open!: () => void;
  const done = new Promise<void>((resolve) => (open = resolve));
  return { done, open };
}

describe("워크스페이스 폴더 읽기 순서 (SYS-09)", () => {
  it("앞 단계가 끝나기 전에는 다음 단계를 시작하지 않는다", async () => {
    const calls: string[] = [];
    const first = gate();
    const run = loadWorkspaceInOrder("/ws", [
      async (p) => {
        calls.push(`pages:${p}`);
        await first.done;
        calls.push("pages:done");
      },
      async () => {
        calls.push("session");
      },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(["pages:/ws"]);
    first.open();
    await run;
    expect(calls).toEqual(["pages:/ws", "pages:done", "session"]);
  });

  it("한 단계가 실패해도 다음 단계는 실행한다", async () => {
    const calls: string[] = [];
    await loadWorkspaceInOrder("/ws", [
      async () => {
        throw new Error("EPERM");
      },
      async () => {
        calls.push("meta");
      },
    ]);
    expect(calls).toEqual(["meta"]);
  });
});
