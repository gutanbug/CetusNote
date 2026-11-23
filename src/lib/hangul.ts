const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** 한글 음절의 초성 (음절이 아니면 그대로) */
export function choseong(ch: string): string {
  const code = ch.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 ? CHOSEONG[Math.floor(code / 588)]! : ch;
}

/** 글자마다 초성으로 바꾼다 — 길이가 같아 위치를 그대로 쓸 수 있다 ("문서 3" → "ㅁㅅ 3") */
export function toChoseong(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += choseong(s[i]!);
  return out;
}

/** 초성(ㄱ–ㅎ)만으로 된 낱말인지 */
export function isChoseong(s: string): boolean {
  return s.length > 0 && [...s].every((c) => CHOSEONG.includes(c));
}

/** 제목이 친 글자로 시작하는지 — 글자마다 그대로 또는 한글 초성으로 맞춘다 */
export function startsWithTyped(title: string, typed: string): boolean {
  const t = [...title.toLowerCase()];
  return [...typed].every((c, i) => t[i] !== undefined && (t[i] === c || choseong(t[i]!) === c));
}
