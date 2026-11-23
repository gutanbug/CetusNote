/** 시간대 인사 (프로토타입 homeHTML) — 로컬 앱이라 이름은 붙이지 않는다 */
export function greeting(hour: number): string {
  return hour < 5
    ? "늦은 밤이네요"
    : hour < 11
      ? "좋은 아침이에요"
      : hour < 17
        ? "좋은 오후예요"
        : "좋은 저녁이에요";
}
