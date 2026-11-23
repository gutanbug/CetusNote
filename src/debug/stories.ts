import { composeStories } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { idFromTitle } from "./ids";

// 스토리(*.stories.tsx)를 견본의 단일 소스로 쓴다 (docs/dev/debug-screen.md §2).
// 스토리 title의 마지막 조각("L1 UI/UI-Button" → "UI-Button")이 레지스트리 ID다.

export interface DebugStory {
  key: string;
  name: string;
  Component: ComponentType;
  /** 모달처럼 화면 전체를 덮는 견본. 버튼을 눌렀을 때만 띄운다. */
  isolate: boolean;
}

type DebugParams = { debug?: { isolate?: boolean } };
type Composed = ComponentType & { storyName?: string; parameters?: DebugParams };
type StoryModule = { default: { title?: string; parameters?: DebugParams } };

const modules = import.meta.glob("/src/components/**/*.stories.tsx");
// 모듈 네임스페이스는 export 이름을 알파벳순으로 돌려준다. 파일에 적힌 순서를 쓰려고 원문도 읽는다.
const sources = import.meta.glob<string>("/src/components/**/*.stories.tsx", {
  query: "?raw",
  import: "default",
});

function exportOrder(source: string): string[] {
  return [...source.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
}

export async function loadStories(): Promise<Map<string, DebugStory[]>> {
  const byId = new Map<string, DebugStory[]>();
  const loaded = await Promise.all(
    Object.entries(modules)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([file, load]) => ({
        file,
        mod: (await load()) as StoryModule,
        order: exportOrder(await sources[file]()),
      })),
  );
  for (const { file, mod, order } of loaded) {
    const id = idFromTitle(mod.default.title ?? "");
    const isolateAll = Boolean(mod.default.parameters?.debug?.isolate);
    const composed = composeStories(mod as never) as Record<string, Composed>;
    const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
    const entries = Object.entries(composed).sort(([a], [b]) => rank(a) - rank(b));
    const list = entries.map(([key, Story]) => ({
      // 한 ID를 여러 파일이 나눠 쓸 수 있어 파일 경로까지 넣어 고유하게 만든다
      key: `${file}#${key}`,
      name: Story.storyName ?? key,
      Component: Story,
      isolate: isolateAll || Boolean(Story.parameters?.debug?.isolate),
    }));
    byId.set(id, [...(byId.get(id) ?? []), ...list]);
  }
  return byId;
}
