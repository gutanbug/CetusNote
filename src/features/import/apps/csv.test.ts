import { describe, expect, it } from "vitest";
import { cellValue, inferColumns, parseCsv } from "./csv";

describe("가져오기 CSV (DATA-11)", () => {
  it("따옴표·줄바꿈·CRLF·BOM을 읽고 빈 줄은 뺀다", () => {
    const rows = parseCsv('\uFEFF이름,메모\r\n"가, 나","첫 줄\n둘째 ""줄"""\r\n\r\n다,\r\n');
    expect(rows).toEqual([
      ["이름", "메모"],
      ["가, 나", '첫 줄\n둘째 "줄"'],
      ["다", ""],
    ]);
  });

  it("값으로 종류를 짐작한다: 체크·날짜·숫자·다중·선택·글", () => {
    const header = ["Name", "완료", "마감", "점수", "태그", "분류", "설명"];
    const rows = [
      ["a", "Yes", "2026-01-02", "3", "독서, 메모", "업무", "긴 글 하나"],
      ["b", "No", "2026-02-03", "4.5", "메모", "업무", "두 번째"],
      ["c", "", "", "", "", "개인", "세 번째"],
    ];
    const cols = inferColumns(header, rows);
    expect(cols.map((c) => c.type)).toEqual([
      "checkbox",
      "date",
      "number",
      "multi",
      "select",
      "text",
    ]);
    expect(cols[3]!.options).toEqual(["독서", "메모"]);
    expect(cols[4]!.options).toEqual(["업무", "개인"]);
  });

  it("값이 맞지 않으면 null, 종류별로 변환한다", () => {
    const [check, date, num, multi, text] = inferColumns(
      ["n", "c", "d", "x", "태그", "m"],
      [
        ["1", "Yes", "2026-01-02T10:00", "2", "a, b", "x"],
        ["2", "No", "2026-01-03", "1.5", "", "y"],
        ["3", "", "", "", "", "z"],
      ],
    );
    expect(cellValue(check!, "Yes")).toBe(true);
    expect(cellValue(check!, "No")).toBeNull();
    expect(cellValue(date!, "2026-01-02T10:00")).toBe("2026-01-02");
    expect(cellValue(date!, "어제")).toBeNull();
    expect(cellValue(num!, "2")).toBe(2);
    expect(cellValue(num!, "abc")).toBeNull();
    expect(cellValue(multi!, "a, b,")).toEqual(["a", "b"]);
    expect(cellValue(text!, "  ")).toBeNull();
  });

  it("값이 전부 비었으면 글 열이다", () => {
    expect(
      inferColumns(
        ["n", "빈"],
        [
          ["a", ""],
          ["b", ""],
        ],
      )[0]!.type,
    ).toBe("text");
  });
});
