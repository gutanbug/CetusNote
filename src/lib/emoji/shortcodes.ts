import { msg, type Messages } from "@/lib/i18n";
/**
 * `:smile` 같은 단축 코드 목록과 매칭 도우미 (ED-EmojiInline의 제안 목록).
 * 목록은 자주 쓰는 것만 둔다 — 전체 이모지 검색은 OV-EmojiPicker가 한다.
 * code는 소문자·숫자·밑줄만 쓴다.
 */

export type ShortcodeItem = {
  /** 입력할 이름 (콜론 없이): "smile" */
  code: string;
  emoji: string;
  /** 목록에 보이는 이름 (지금 언어). 읽을 때마다 바뀔 수 있다 */
  readonly label: string;
};

type EmojiCode = keyof Messages["page"]["emoji"];

/** 단축 코드 한 항목. label은 getter라 부르는 순간의 언어로 읽힌다 */
const sc = (code: EmojiCode, emoji: string): ShortcodeItem => ({
  code,
  emoji,
  get label() {
    return msg().page.emoji[code];
  },
});

export const SHORTCODES: readonly ShortcodeItem[] = [
  sc("smile", "😄"),
  sc("grin", "😀"),
  sc("joy", "😂"),
  sc("wink", "😉"),
  sc("thinking", "🤔"),
  sc("sunglasses", "😎"),
  sc("sob", "😭"),
  sc("eyes", "👀"),
  sc("wave", "👋"),
  sc("thumbsup", "👍"),
  sc("thumbsdown", "👎"),
  sc("clap", "👏"),
  sc("pray", "🙏"),
  sc("muscle", "💪"),
  sc("ok_hand", "👌"),
  sc("heart", "❤️"),
  sc("sparkles", "✨"),
  sc("star", "⭐"),
  sc("fire", "🔥"),
  sc("zap", "⚡"),
  sc("tada", "🎉"),
  sc("rocket", "🚀"),
  sc("bulb", "💡"),
  sc("memo", "📝"),
  sc("pin", "📌"),
  sc("calendar", "📅"),
  sc("books", "📚"),
  sc("coffee", "☕"),
  sc("target", "🎯"),
  sc("seedling", "🌱"),
  sc("sun", "☀️"),
  sc("moon", "🌙"),
  sc("check", "✅"),
  sc("x", "❌"),
  sc("warning", "⚠️"),
  sc("question", "❓"),
  sc("lock", "🔒"),
  sc("link", "🔗"),
];

/** 입력한 코드 앞의 콜론을 떼고 소문자로 맞춘다. 허용하지 않는 글자가 있으면 null (목록을 띄우지 않는다) */
export function normalizeShortcodeQuery(raw: string): string | null {
  const q = raw.replace(/^:/, "").toLowerCase();
  return /^[a-z0-9_]*$/.test(q) ? q : null;
}

/**
 * 이름 앞부분이 맞는 것을 먼저, 그다음 가운데 포함. 빈 입력은 목록의 앞쪽을 돌려준다.
 * limit을 넘는 결과는 자른다.
 */
export function matchShortcodes(raw: string, limit = 8): ShortcodeItem[] {
  const q = normalizeShortcodeQuery(raw);
  if (q === null) return [];
  if (q === "") return SHORTCODES.slice(0, limit);
  const prefix = SHORTCODES.filter((s) => s.code.startsWith(q));
  const inside = SHORTCODES.filter((s) => !s.code.startsWith(q) && s.code.includes(q));
  return [...prefix, ...inside].slice(0, limit);
}

/** 목록에서 활성 항목 옮기기: 위·아래 키는 끝에서 돌아간다 */
export function nextActiveIndex(
  current: number,
  key: "ArrowUp" | "ArrowDown",
  count: number,
): number {
  if (count <= 0) return -1;
  const step = key === "ArrowDown" ? 1 : -1;
  return (((current + step) % count) + count) % count;
}
