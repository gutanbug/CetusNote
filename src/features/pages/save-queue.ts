import { StorageError, type Page } from "@/lib/storage";
import { currentWorkspaceGeneration } from "@/features/workspace/generation";

/** SH-SaveStatus와 같은 값 */
export type SaveState = "saved" | "saving" | "error";

type SaveQueueOptions = {
  write: (page: Page) => Promise<void>;
  /** 편집이 멈춘 뒤 저장까지 기다리는 시간 (architecture.md §3: 약 800ms) */
  delay?: number;
  onStateChange?: (state: SaveState, error: unknown) => void;
  /** 워크스페이스 세대 (DATA-03). 기다리는 사이 워크스페이스가 바뀌었으면 그 내용은 쓰지 않는다 */
  generation?: () => number;
};

/** 워크스페이스가 바뀐 뒤에 남은 변경 — 다른 폴더에 쓰지 않고 오류로 알린다 */
export class StaleWriteError extends Error {
  constructor() {
    super("워크스페이스를 바꾸는 사이 남은 변경이라 저장하지 않았어요");
    this.name = "StaleWriteError";
  }
}

/**
 * 자동 저장 대기열 (DATA-01).
 * - 페이지마다 따로 디바운스한다. 같은 페이지의 쓰기는 겹치지 않게 차례로 한다.
 * - 쓰는 동안 또 바뀌면 끝난 뒤 최신 내용으로 한 번 더 쓴다(중간 값은 건너뛴다).
 * - 실패하면 그 내용을 버리지 않고 들고 있다가 다음 편집·retry·flush 때 다시 쓴다.
 * - 편집할 때의 워크스페이스 세대와 쓸 때의 세대가 다르면 쓰지 않고 오류로 남긴다(DATA-03).
 * 상태: 기다리거나 쓰는 중이면 saving, 실패한 내용이 남아 있으면 error, 아니면 saved.
 */
export function createSaveQueue({
  write,
  delay = 800,
  onStateChange,
  generation = currentWorkspaceGeneration,
}: SaveQueueOptions) {
  const pending = new Map<string, Page>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const running = new Map<string, Promise<void>>();
  const failed = new Set<string>();
  /** 대기 중인 내용을 만든 워크스페이스 세대 */
  const gens = new Map<string, number>();
  let lastError: unknown = null;
  let state: SaveState = "saved";

  const update = () => {
    const next: SaveState = failed.size
      ? "error"
      : pending.size || running.size
        ? "saving"
        : "saved";
    if (next !== state) {
      state = next;
      onStateChange?.(state, next === "error" ? lastError : null);
    }
  };

  /** id의 대기 내용을 쓴다. 이미 쓰는 중이면 그 뒤에 이어서 쓴다. 성공하면 true */
  const run = (id: string): Promise<void> => {
    const prev = running.get(id);
    const task = (async () => {
      if (prev) await prev;
      const page = pending.get(id);
      if (!page) return;
      pending.delete(id);
      const gen = gens.get(id);
      gens.delete(id);
      if (gen !== generation()) {
        // 다른 워크스페이스의 내용이다. 현재 폴더에 쓰면 안 되므로 버리고 알린다
        failed.add(id);
        lastError = new StaleWriteError();
        return;
      }
      try {
        await write(page);
        failed.delete(id);
      } catch (e) {
        if (e instanceof StorageError && e.code === "stale_workspace") {
          // 워크스페이스를 바꾼 뒤 도착한 옛 폴더의 쓰기(Rust가 거절). 다시 쓰면 안 되므로 버리고 오류로 남긴다
          failed.add(id);
          lastError = e;
          return;
        }
        // 그동안 더 새 내용이 들어왔으면 그것을 남기고, 아니면 실패한 내용을 되돌려 둔다
        if (!pending.has(id)) {
          pending.set(id, page);
          gens.set(id, gen ?? generation());
        }
        failed.add(id);
        lastError = e;
      }
    })();
    running.set(id, task);
    update();
    return task.finally(() => {
      if (running.get(id) === task) running.delete(id);
      update();
    });
  };

  const clearTimer = (id: string) => {
    const t = timers.get(id);
    if (t !== undefined) clearTimeout(t);
    timers.delete(id);
  };

  /** 지금 기다리는 모든 페이지를 바로 쓴다. 모두 저장됐으면 true */
  const flush = async (): Promise<boolean> => {
    for (const id of timers.keys()) clearTimer(id);
    await Promise.all([...new Set([...pending.keys(), ...running.keys()])].map(run));
    return failed.size === 0 && pending.size === 0;
  };

  return {
    /** 바뀐 페이지를 맡긴다 — delay 뒤에 저장 */
    schedule(page: Page) {
      pending.set(page.id, page);
      gens.set(page.id, generation());
      clearTimer(page.id);
      timers.set(
        page.id,
        setTimeout(() => {
          timers.delete(page.id);
          void run(page.id);
        }, delay),
      );
      update();
    },
    /** 한 페이지만 바로 저장 (페이지를 떠날 때) */
    async flushPage(id: string): Promise<boolean> {
      clearTimer(id);
      await run(id);
      return !failed.has(id);
    },
    flush,
    /** 실패한 저장을 다시 시도 (SH-SaveStatus의 “다시 시도”) */
    retry: flush,
    /** 아직 기다리는 내용을 버린다 (영구 삭제 직전) */
    discard(id: string) {
      clearTimer(id);
      pending.delete(id);
      gens.delete(id);
      failed.delete(id);
      update();
    },
    /** 워크스페이스를 새로 읽기 전에 대기·실패 상태를 모두 비운다 (쓰는 중인 것은 그대로 끝난다) */
    reset() {
      for (const id of timers.keys()) clearTimer(id);
      pending.clear();
      gens.clear();
      failed.clear();
      update();
    },
    get state() {
      return state;
    },
    /** 이 페이지에 아직 파일에 가지 않은 변경이 있다 */
    isUnsaved(id: string) {
      return pending.has(id) || running.has(id) || failed.has(id);
    },
    get hasUnsaved() {
      return pending.size > 0 || running.size > 0;
    },
  };
}

export type SaveQueue = ReturnType<typeof createSaveQueue>;
