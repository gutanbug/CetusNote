import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { registry, type Status } from "./registry";
import { idFromTitle } from "./ids";

// docs/dev/debug-screen.md §6 — 레지스트리 · components.md · 스토리가 서로 맞는지 검사한다.

const root = path.resolve(import.meta.dirname, "../..");
const STATUS: Record<string, Status> = {
  계획: "planned",
  구현: "implemented",
  Ready: "ready",
  "감사 완료": "audited",
};

/** components.md의 L1–L6 표에서 ID와 진행 상태를 읽는다 */
function readInventory() {
  const lines = readFileSync(path.join(root, "docs/design/components.md"), "utf8").split("\n");
  const rows = new Map<string, Status>();
  let header: string[] = [];
  let inLayer = false;
  for (const line of lines) {
    const heading = /^## (L\d)/.exec(line);
    if (line.startsWith("## ")) inLayer = Boolean(heading && /L[1-6]/.test(heading[1]));
    if (!inLayer || !line.startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
    if (cells[0] === "ID") {
      header = cells;
      continue;
    }
    if (!/^(UI|OV|SH|ED|PG|CL)-/.test(cells[0])) continue;
    const progress = cells[header.indexOf("진행")];
    rows.set(cells[0], STATUS[progress ?? ""] ?? "planned");
  }
  return rows;
}

function readStoryIds() {
  const dir = path.join(root, "src/components");
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) =>
    f.endsWith(".stories.tsx"),
  );
  return files.map((f) => {
    const text = readFileSync(path.join(dir, f), "utf8");
    // 견본 데이터의 title이 아니라 스토리 메타의 title("L1 UI/UI-Button" 꼴)만 읽는다
    const title = /title:\s*"(L\d [^"/]+\/[^"]+)"/.exec(text)?.[1] ?? "";
    return { file: f, id: idFromTitle(title) };
  });
}

describe("Debug 레지스트리", () => {
  const inventory = readInventory();
  const stories = readStoryIds();

  it("components.md의 ID와 레지스트리 ID가 같다", () => {
    expect(Object.keys(registry).sort()).toEqual([...inventory.keys()].sort());
  });

  it("진행 상태가 components.md와 같다", () => {
    for (const [id, status] of inventory) {
      expect({ id, status: registry[id as keyof typeof registry].status }).toEqual({ id, status });
    }
  });

  it("구현 이상인 ID는 스토리가 하나 이상 있다", () => {
    const withStory = new Set(stories.map((s) => s.id));
    const missing = Object.entries(registry)
      // 지금은 계획 중인 ID가 없어 타입이 좁혀진다 — 계획 ID가 다시 생겨도 같은 검사
      .filter(([, e]) => (e.status as string) !== "planned")
      .map(([id]) => id)
      .filter((id) => !withStory.has(id));
    expect(missing).toEqual([]);
  });

  it("레지스트리에 없는 ID로 된 스토리가 없다", () => {
    const unknown = stories.filter((s) => !(s.id in registry));
    expect(unknown).toEqual([]);
  });
});

// 열린 모달 견본이 Debug 화면 전체를 덮어 아무것도 누를 수 없게 되는 일을 막는다.
// ui/dialog를 쓰는 컴포넌트의 스토리는 debug.isolate(버튼으로 따로 띄우기)여야 한다.
describe("모달 견본 격리", () => {
  const root = path.resolve(__dirname, "../components");
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
    (f) => f.endsWith(".tsx") && !f.endsWith(".stories.tsx"),
  );
  const modal = files.filter((f) =>
    /from "(@\/components\/ui\/dialog|\.\/dialog)"/.test(readFileSync(path.join(root, f), "utf8")),
  );
  it.each(modal)("%s 스토리는 isolate", (f) => {
    const story = path.join(root, f.replace(/\.tsx$/, ".stories.tsx"));
    expect(readFileSync(story, "utf8")).toMatch(/debug:\s*\{\s*isolate:\s*true/);
  });
});
