/** 스토리 title → 컴포넌트 ID ("L1 UI/UI-Button" → "UI-Button") */
export function idFromTitle(title: string): string {
  return title.split("/").pop()?.trim() ?? title;
}
