import { PluginKey } from "@tiptap/pm/state";

/**
 * `@tiptap/y-tiptap` 대역 (SYS-11). 실시간 협업(Yjs)은 범위 밖이라 쓰지 않는데,
 * `@tiptap/extension-drag-handle`이 협업 위치 변환을 위해 이 모듈을 불러 yjs·lib0까지 약 530KB가 시작 번들에 들어왔다.
 * 끌기 손잡이는 `ySyncPluginKey.getState(state)`가 없으면(협업 플러그인이 없으면) 바로 돌아가므로,
 * 같은 이름의 키만 두고 변환 함수는 불리면 알리도록 둔다. vite.config.ts의 alias가 이 파일로 돌린다.
 */
export const ySyncPluginKey = new PluginKey("y-sync");

function unsupported(): never {
  throw new Error("Real-time collaboration (Yjs) is not supported");
}

export const absolutePositionToRelativePosition = unsupported;
export const relativePositionToAbsolutePosition = unsupported;
