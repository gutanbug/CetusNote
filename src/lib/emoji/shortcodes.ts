/**
 * `:smile` 같은 단축 코드 목록과 매칭 도우미 (ED-EmojiInline의 제안 목록).
 * 목록은 자주 쓰는 것만 둔다 — 전체 이모지 검색은 OV-EmojiPicker가 한다.
 * code는 소문자·숫자·밑줄만 쓴다.
 */

export type ShortcodeItem = {
  /** 입력할 이름 (콜론 없이): "smile" */
  code: string;
  emoji: string;
  /** 한국어 이름 (목록에 같이 보인다) */
  label: string;
};

export const SHORTCODES: readonly ShortcodeItem[] = [
  { code: "smile", emoji: "😄", label: "웃는 얼굴" },
  { code: "grin", emoji: "😀", label: "활짝 웃음" },
  { code: "joy", emoji: "😂", label: "눈물 나게 웃음" },
  { code: "wink", emoji: "😉", label: "윙크" },
  { code: "thinking", emoji: "🤔", label: "생각 중" },
  { code: "sunglasses", emoji: "😎", label: "선글라스" },
  { code: "sob", emoji: "😭", label: "펑펑 우는 얼굴" },
  { code: "eyes", emoji: "👀", label: "눈" },
  { code: "wave", emoji: "👋", label: "손 흔들기" },
  { code: "thumbsup", emoji: "👍", label: "좋아요" },
  { code: "thumbsdown", emoji: "👎", label: "싫어요" },
  { code: "clap", emoji: "👏", label: "박수" },
  { code: "pray", emoji: "🙏", label: "기도, 감사" },
  { code: "muscle", emoji: "💪", label: "힘" },
  { code: "ok_hand", emoji: "👌", label: "좋음 손 모양" },
  { code: "heart", emoji: "❤️", label: "빨간 하트" },
  { code: "sparkles", emoji: "✨", label: "반짝임" },
  { code: "star", emoji: "⭐", label: "별" },
  { code: "fire", emoji: "🔥", label: "불" },
  { code: "zap", emoji: "⚡", label: "번개" },
  { code: "tada", emoji: "🎉", label: "축하" },
  { code: "rocket", emoji: "🚀", label: "로켓" },
  { code: "bulb", emoji: "💡", label: "전구, 아이디어" },
  { code: "memo", emoji: "📝", label: "메모" },
  { code: "pin", emoji: "📌", label: "압정" },
  { code: "calendar", emoji: "📅", label: "달력" },
  { code: "books", emoji: "📚", label: "책" },
  { code: "coffee", emoji: "☕", label: "커피" },
  { code: "target", emoji: "🎯", label: "목표" },
  { code: "seedling", emoji: "🌱", label: "새싹" },
  { code: "sun", emoji: "☀️", label: "해" },
  { code: "moon", emoji: "🌙", label: "달" },
  { code: "check", emoji: "✅", label: "완료 체크" },
  { code: "x", emoji: "❌", label: "엑스 표시" },
  { code: "warning", emoji: "⚠️", label: "주의" },
  { code: "question", emoji: "❓", label: "물음표" },
  { code: "lock", emoji: "🔒", label: "잠금" },
  { code: "link", emoji: "🔗", label: "링크" },
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
