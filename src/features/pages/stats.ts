import { intlLocale, msg } from "@/lib/i18n";
import { docText } from "@/features/search/search-index";

export type DocStats = {
  /** 글자 수 (공백 포함) */
  chars: number;
  /** 글자 수 (공백 제외) */
  charsNoSpace: number;
  /** 띄어쓰기로 나눈 단어 수 */
  words: number;
  /** 읽는 시간(분, 1 이상). 본문이 비면 0 */
  minutes: number;
};

/** 한글·한자·가나는 1분에 약 500자, 그 밖의 글은 1분에 약 200단어로 셈한다 */
const CJK = /[ᄀ-ᇿ぀-ヿ㄰-㆏一-鿿가-힯]/g;
const CJK_PER_MIN = 500;
const WORDS_PER_MIN = 200;

/** 본문(Tiptap JSON)의 글자·단어 수와 읽는 시간 (PAGE-11) */
export function docStats(doc: unknown): DocStats {
  const text = docText(doc).normalize("NFC");
  const chars = [...text.replace(/\n/g, "")].length;
  const charsNoSpace = [...text.replace(/\s/g, "")].length;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (!charsNoSpace) return { chars, charsNoSpace, words, minutes: 0 };
  const cjk = text.match(CJK)?.length ?? 0;
  const otherWords = text.replace(CJK, " ").split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(cjk / CJK_PER_MIN + otherWords / WORDS_PER_MIN));
  return { chars, charsNoSpace, words, minutes };
}

/** 페이지 메뉴에 보일 한 줄: "글자 1,234 · 단어 210 · 약 3분" */
export function formatDocStats(s: DocStats): string {
  if (!s.charsNoSpace) return msg().features.pages.statsEmpty;
  const num = new Intl.NumberFormat(intlLocale());
  return msg().features.pages.statsSummary(num.format(s.chars), num.format(s.words), s.minutes);
}
