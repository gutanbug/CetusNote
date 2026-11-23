/**
 * 문서 가져오기(DATA-08) 끝의 알림 문구. 가져온 문서와 읽지 못한 파일을 한 줄로 요약한다.
 * 예: "문서 2개를 가져왔어요" · "2개를 가져왔고 1개는 읽지 못했어요" · "문서를 가져오지 못했어요"
 */

export type ImportFailure = { name: string; reason: string };

export type ImportSummary = { message: string; description?: string };

/** titles: 가져온 문서 제목(순서대로), failed: 읽지 못한 파일. 둘 다 없으면 null(알릴 것이 없다) */
export function importSummary(titles: string[], failed: ImportFailure[]): ImportSummary | null {
  if (!titles.length && !failed.length) return null;
  const description = failed.length
    ? failed.map((f) => `${f.name} (${f.reason})`).join(", ")
    : undefined;
  const n = titles.length;
  if (!n) return { message: "문서를 가져오지 못했어요", description };
  const got = n === 1 ? `“${titles[0]}” 문서를` : `${n}개를`;
  if (!failed.length) {
    return { message: n === 1 ? `${got} 가져왔어요` : `문서 ${n}개를 가져왔어요` };
  }
  return { message: `${got} 가져왔고 ${failed.length}개는 읽지 못했어요`, description };
}
