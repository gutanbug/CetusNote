/**
 * 앱 아이콘 고르기 (SET-07). 설정의 "자동"은 지금 테마(라이트·다크)를 따르고,
 * "화이트"·"블랙"은 테마와 상관없이 그 아이콘을 쓴다. 실제 아이콘 교체는 Rust 커맨드(app_icon_set)가 한다.
 */
export type AppIconPref = "auto" | "light" | "dark";
export type AppIconTheme = "light" | "dark";

/** 설정 값 검사. 모르는 값이면 자동 */
export function parseAppIconPref(raw: unknown): AppIconPref {
  return raw === "light" || raw === "dark" ? raw : "auto";
}

/** 설정과 지금 테마로 실제 아이콘을 정한다. light = 화이트, dark = 블랙 */
export function resolveAppIcon(pref: AppIconPref, theme: AppIconTheme): AppIconTheme {
  return pref === "auto" ? theme : pref;
}
