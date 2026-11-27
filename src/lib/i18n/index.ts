import { useSyncExternalStore } from "react";
import { en } from "./en";
import { ko, type Messages } from "./ko";

/**
 * 다국어 (SYS-14) — 한국어·영어.
 *
 * 문구는 키 문자열이 아니라 타입이 있는 객체로 읽는다: `const m = useMessages(); m.settings.general.title`.
 * 값에 매개변수가 필요하면 함수로 둔다(`m.page.count(3)`). 영어 복수형·한국어 조사도 그 함수 안에서 처리한다.
 * - React 컴포넌트: `useMessages()` — 언어가 바뀌면 다시 그린다.
 * - 그 밖의 코드(토스트, 명령 목록, 내보내기): `msg()` — 부르는 순간의 언어. 모듈을 읽을 때 한 번만 부르지 않는다.
 * 테스트·스토리는 따로 정하지 않으면 한국어로 돈다.
 */
export type { Messages };
export type Locale = "ko" | "en";
export type LanguagePref = "system" | Locale;

export const LOCALES: readonly Locale[] = ["ko", "en"];
/** 언어 이름은 그 언어로 쓴다(어느 언어 화면에서든 자기 언어를 찾을 수 있게) */
export const LOCALE_NAMES: Record<Locale, string> = { ko: "한국어", en: "English" };
const CATALOGS: Record<Locale, Messages> = { ko, en };

let locale: Locale = "ko";
const listeners = new Set<() => void>();

/** 시스템 언어 목록에서 지원하는 첫 언어. 없으면 영어 */
export function systemLocale(
  languages: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages,
): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "ko" || base === "en") return base;
  }
  return "en";
}

export function parseLanguagePref(raw: unknown): LanguagePref {
  return raw === "ko" || raw === "en" ? raw : "system";
}

export function resolveLocale(pref: LanguagePref, languages?: readonly string[]): Locale {
  return pref === "system" ? systemLocale(languages) : pref;
}

export function getLocale(): Locale {
  return locale;
}

/** 언어를 바꾼다. <html lang>도 함께 바꾸고, 구독한 화면을 다시 그린다 */
export function setLocale(next: Locale): void {
  if (typeof document !== "undefined") document.documentElement.lang = next;
  if (next === locale) return;
  locale = next;
  for (const l of listeners) l();
}

/** 언어가 바뀔 때 부른다 (네이티브 메뉴 등). 해제 함수를 돌려준다 */
export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 지금 언어의 문구 (React 밖) */
export function msg(): Messages {
  return CATALOGS[locale];
}

/** 특정 언어의 문구 (테스트, 언어 이름 표시) */
export function messagesFor(l: Locale): Messages {
  return CATALOGS[l];
}

export function useLocale(): Locale {
  return useSyncExternalStore(onLocaleChange, getLocale, getLocale);
}

/** 지금 언어의 문구 (React) */
export function useMessages(): Messages {
  return CATALOGS[useLocale()];
}

/** 언어에 맞춘 Intl 로캘 태그 */
export function intlLocale(l: Locale = locale): string {
  return l === "ko" ? "ko-KR" : "en-US";
}
