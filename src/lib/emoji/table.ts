import { SHORTCODES } from "./shortcodes";

/**
 * 전체 이모지 표 (SYS-11). `@tiptap/extension-emoji`의 목록(약 450 kB)은 시작 번들에 넣지 않고
 * 처음 필요할 때 동적으로 가져와 캐시한다. 그 전에는 우리 단축 코드 목록(SHORTCODES)으로 그린다.
 * 표를 찾는 규칙은 Tiptap Emoji의 `shortcodeToEmoji`·`emojiToShortcode`·스토리지 지원 판정과 같다.
 */

/** 이모지 항목 (Tiptap 데이터의 필요한 필드) */
export type EmojiEntry = {
  emoji: string;
  name: string;
  shortcodes: string[];
  version?: number;
  fallbackImage?: string;
};

type EmojiSource = Omit<EmojiEntry, "emoji"> & { emoji?: string };

type Index = {
  /** 이름 또는 단축 코드 → 항목 (먼저 나온 항목이 이긴다) */
  byKey: Map<string, EmojiEntry>;
  /** 이모지 글자 → 첫 단축 코드 (입력된 이모지를 노드로 바꿀 때) */
  byChar: Map<string, string | undefined>;
  /** 버전 → 이 환경이 그릴 수 있는지 */
  supported: Map<number, boolean>;
};

export type EmojiTable = {
  /** 모든 이모지 (내보내기용: Tiptap 원본 목록과 같다) */
  all: Index;
  /** 에디터가 쓰는 목록 — ©®™는 글자로 둔다 (EDIT-18) */
  editor: Index;
  /** 이모지 글자 연속열을 찾는 정규식 (emoji-regex, Tiptap과 같은 것) */
  emojiRegex: () => RegExp;
};

/** ©(c)·®(r)·™(tm)은 이모지가 아니라 글자로 남긴다 (EDIT-18) */
export const TEXT_SYMBOLS: ReadonlySet<string> = new Set(["copyright", "registered", "tm"]);

let table: EmojiTable | null = null;
let pending: Promise<EmojiTable> | null = null;
const listeners = new Set<() => void>();

/** 표가 이미 준비됐으면 돌려준다. 아니면 null */
export function getEmojiTable(): EmojiTable | null {
  return table;
}

/** 표를 가져와 준비한다. 여러 번 불러도 한 번만 가져온다 */
export function loadEmojiTable(): Promise<EmojiTable> {
  pending ??= Promise.all([
    import("@tiptap/extension-emoji"),
    import("is-emoji-supported"),
    import("emoji-regex"),
  ]).then(([{ emojis }, { isEmojiSupported }, { default: emojiRegex }]) => {
    const source = emojis as readonly EmojiSource[];
    const all = buildIndex(source, isEmojiSupported);
    const editor = buildIndex(
      source.filter((e) => !TEXT_SYMBOLS.has(e.name)),
      isEmojiSupported,
    );
    table = { all, editor, emojiRegex };
    for (const listener of listeners) listener();
    return table;
  });
  // 실패하면 다음 호출에서 다시 시도한다
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

/** 표를 미리 가져오기만 한다 (실패는 무시 — 다음 필요할 때 다시 시도) */
export function prefetchEmojiTable(): void {
  loadEmojiTable().catch(() => undefined);
}

/** 표가 준비되면 부를 콜백을 건다. 돌려주는 함수로 뗀다 */
export function onEmojiTableLoad(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 이름(또는 단축 코드)으로 항목을 찾는다. 표가 없으면 SHORTCODES에서만 찾는다.
 * 표가 없을 때 못 찾은 이름은 undefined — 호출한 쪽이 표를 기다린다.
 */
export function findEmoji(name: string, scope: "all" | "editor"): EmojiEntry | undefined {
  if (table) return table[scope].byKey.get(name);
  if (scope === "editor" && TEXT_SYMBOLS.has(name)) return undefined;
  const item = SHORTCODES.find((s) => s.code === name);
  return item ? { emoji: item.emoji, name: item.code, shortcodes: [item.code] } : undefined;
}

/** 항목의 버전을 이 환경이 그릴 수 있는지 (Tiptap의 storage.isSupported와 같다) */
export function isEmojiSupported(entry: EmojiEntry): boolean {
  if (!table || !entry.version) return false;
  return table.editor.supported.get(entry.version) ?? false;
}

function buildIndex(
  items: readonly EmojiSource[],
  supportCheck: (emoji: string) => boolean,
): Index {
  const byKey = new Map<string, EmojiEntry>();
  const byChar = new Map<string, string | undefined>();
  const firstByVersion = new Map<number, EmojiSource>();
  for (const item of items) {
    const entry = item as EmojiEntry;
    for (const key of [item.name, ...item.shortcodes]) {
      if (!byKey.has(key)) byKey.set(key, entry);
    }
    if (item.emoji && !byChar.has(item.emoji)) byChar.set(item.emoji, item.shortcodes[0]);
    if (typeof item.version === "number" && item.emoji && !firstByVersion.has(item.version)) {
      firstByVersion.set(item.version, item);
    }
  }
  const supported = new Map<number, boolean>();
  for (const item of items) {
    if (typeof item.version !== "number" || supported.has(item.version)) continue;
    const first = firstByVersion.get(item.version);
    supported.set(item.version, first?.emoji ? supportCheck(first.emoji) : false);
  }
  return { byKey, byChar, supported };
}

/** Tiptap과 같은 정규화: 첫 번째 VS15·VS16만 뺀다 */
export function removeVariationSelector(value: string): string {
  return value.replace("︎", "").replace("️", "");
}
