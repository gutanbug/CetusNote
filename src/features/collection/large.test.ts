import { describe, expect, it } from "vitest";
import { makePerfCollection, PERF_FIELDS } from "./perf-fixtures";
import { collectionRecords, queryRecords } from "./model";

// 큰 컬렉션(1만 건)에서 거르기·정렬 결과의 모양을 확인한다 (SYS-11). 시간은 재지 않는다 — 측정 수치는 커밋 메시지·문서에 둔다.
describe("큰 컬렉션 거르기·정렬 (1만 건)", () => {
  const { collection, pages, settings } = makePerfCollection(10_000);
  const records = collectionRecords(pages, collection.id, []);
  const s = {
    ...settings.viewState[settings.view],
    statuses: settings.statuses,
    fields: PERF_FIELDS,
  };

  it("모든 레코드가 빠짐없이 나온다", () => {
    expect(records).toHaveLength(10_000);
    expect(queryRecords(records, s, "")).toHaveLength(10_000);
  });

  it("숫자 속성 정렬은 값이 줄지 않고, 빈 값은 맨 뒤", () => {
    const sorted = queryRecords(records, { ...s, sort: { field: "fperfnum01", dir: "asc" } }, "");
    const nums = sorted.map((p) => p.props.values.fperfnum01 as number);
    for (let i = 1; i < nums.length; i++) expect(nums[i]!).toBeGreaterThanOrEqual(nums[i - 1]!);
  });

  it("제목 정렬은 한국어 규칙(Intl ko)과 같은 순서", () => {
    const sorted = queryRecords(records, { ...s, sort: { field: "title", dir: "asc" } }, "");
    const titles = sorted.map((p) => p.title);
    const collator = new Intl.Collator("ko");
    for (let i = 1; i < titles.length; i++)
      expect(collator.compare(titles[i - 1]!, titles[i]!)).toBeLessThanOrEqual(0);
  });

  it("검색은 사용자 속성 글(메모)까지 찾는다 — 「메모 1234 」는 1234번 레코드 하나", () => {
    const hits = queryRecords(records, s, "메모 1234 ");
    expect(hits.map((p) => p.title)).toEqual(["레코드 34-1234 회의록 검토"]);
  });
});
