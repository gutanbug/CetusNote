import { describe, expect, it } from "vitest";
import { importSummary } from "./summary";

describe("문서 가져오기 알림 (DATA-08)", () => {
  it("알릴 것이 없으면 null", () => {
    expect(importSummary([], [])).toBeNull();
  });
  it("한 개를 가져오면 제목을 넣는다", () => {
    expect(importSummary(["회의"], [])).toEqual({ message: "“회의” 문서를 가져왔어요" });
  });
  it("여러 개를 가져오면 개수로 말한다", () => {
    expect(importSummary(["a", "b"], [])).toEqual({ message: "문서 2개를 가져왔어요" });
  });
  it("일부만 읽으면 가져온 수와 못 읽은 수, 파일 이름을 알린다", () => {
    expect(importSummary(["a", "b"], [{ name: "깨짐", reason: "읽지 못했어요" }])).toEqual({
      message: "2개를 가져왔고 1개는 읽지 못했어요",
      description: "깨짐 (읽지 못했어요)",
    });
    expect(importSummary(["a"], [{ name: "x", reason: "읽지 못했어요" }])?.message).toBe(
      "“a” 문서를 가져왔고 1개는 읽지 못했어요",
    );
  });
  it("모두 못 읽으면 실패 문구", () => {
    expect(importSummary([], [{ name: "x", reason: "읽지 못했어요" }])).toEqual({
      message: "문서를 가져오지 못했어요",
      description: "x (읽지 못했어요)",
    });
  });
});
