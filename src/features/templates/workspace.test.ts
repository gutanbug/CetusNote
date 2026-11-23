import { createPage, normalizePage } from "@/lib/storage/schema";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "./templates";
import {
  builtinTemplatePages,
  fillDateDoc,
  fillDateText,
  isTemplate,
  sortTemplates,
  templateResult,
} from "./workspace";

describe("템플릿 문서 (PAGE-14)", () => {
  it("기본 템플릿은 모두 날짜 자리({{date}})가 있는 템플릿 문서가 된다", () => {
    const list = builtinTemplatePages();
    expect(list.map((t) => t.template.builtin)).toEqual(TEMPLATES.map((t) => t.id));
    const daily = list.find((t) => t.template.builtin === "daily")!;
    expect(daily.title).toBe("일일 노트");
    expect(daily.template.pageTitle).toBe("일일 노트 {{date}}");
  });

  it("적용하면 제목과 본문 글자의 {{date}}를 오늘 날짜로 바꾼다", () => {
    const page = createPage({
      title: "회고",
      icon: "🌙",
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "{{date}} 회고" }] }],
      },
      template: { category: "journal", description: "", builtin: null, pageTitle: "회고 {{date}}" },
    });
    const made = templateResult(page, "2026-11-21");
    expect(made.title).toBe("회고 2026-11-21");
    expect(JSON.stringify(made.content)).toContain("2026-11-21 회고");
    // 원본은 그대로
    expect(JSON.stringify(page.content)).toContain("{{date}}");
  });

  it("미리보기용 채우기는 원본을 바꾸지 않고 날짜 자리만 바꾼다", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "{{date}} 기록" }] }],
    };
    const filled = fillDateDoc(doc, "2026-11-21") as typeof doc;
    expect(filled.content[0]!.content![0]!.text).toBe("2026-11-21 기록");
    expect(doc.content[0]!.content![0]!.text).toBe("{{date}} 기록");
    expect(fillDateText("일일 노트 {{date}} · {{date}}", "2026-11-21")).toBe(
      "일일 노트 2026-11-21 · 2026-11-21",
    );
    expect(fillDateText("날짜 없음", "2026-11-21")).toBe("날짜 없음");
  });

  it("새 문서 제목이 비면 제목 없음", () => {
    const page = createPage({
      title: "빈",
      template: { category: "work", description: "", builtin: null, pageTitle: "" },
    });
    expect(templateResult(page, "2026-11-21").title).toBe("");
  });

  it("기본 템플릿(원래 순서) → 내가 만든 것(만든 순)", () => {
    const mine = createPage({
      title: "내 것",
      template: { category: "work", description: "", builtin: null, pageTitle: "" },
    });
    const [meeting, weekly] = builtinTemplatePages().map((init) => createPage(init));
    expect(sortTemplates([mine, weekly!, meeting!]).map((p) => p.title)).toEqual([
      "회의록",
      "주간 리뷰",
      "내 것",
    ]);
  });

  it("휴지통의 템플릿·일반 문서는 템플릿이 아니다. 폴더에는 template을 두지 않는다", () => {
    const t = createPage({
      template: { category: "work", description: "", builtin: null, pageTitle: "" },
    });
    expect(isTemplate(t)).toBe(true);
    expect(isTemplate({ ...t, trashedAt: "2026-11-21T00:00:00.000Z" })).toBe(false);
    expect(isTemplate(createPage())).toBe(false);
    const folder = normalizePage({ ...t, kind: "folder" });
    expect(folder.template).toBeNull();
  });

  it("스키마 5 파일은 템플릿이 아니다. 이상한 template 값은 기본값으로", () => {
    const old = normalizePage({ schemaVersion: 5, id: createPage().id, title: "옛 문서" });
    expect(old.template).toBeNull();
    const odd = normalizePage({ schemaVersion: 6, id: createPage().id, template: { category: 3 } });
    expect(odd.template).toEqual({
      category: "work",
      description: "",
      pageTitle: "",
      builtin: null,
    });
  });
});
