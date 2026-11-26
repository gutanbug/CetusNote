/**
 * 내보내기 옵션 기억 (DATA-04). 사용자가 끈 값을 이 기기에서 기억한다. 저장소가 막혀 있으면 기본값(켬)을 쓴다.
 */
const FRONT_MATTER_KEY = "cetusnote.export.frontMatter";

/** front matter를 쓸지. 기본 켬 */
export function frontMatterPref(): boolean {
  try {
    return globalThis.localStorage?.getItem(FRONT_MATTER_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setFrontMatterPref(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(FRONT_MATTER_KEY, on ? "on" : "off");
  } catch {
    // 기억하지 못해도 내보내기는 계속된다
  }
}
