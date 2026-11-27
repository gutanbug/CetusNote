import { msg } from "@/lib/i18n";

/** 시간대 인사 (프로토타입 homeHTML) — 로컬 앱이라 이름은 붙이지 않는다 */
export function greeting(hour: number): string {
  const g = msg().screens.home.greeting;
  return hour < 5 ? g.lateNight : hour < 11 ? g.morning : hour < 17 ? g.afternoon : g.evening;
}
