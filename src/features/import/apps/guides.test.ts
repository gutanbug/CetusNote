import { describe, expect, it } from "vitest";
import { guideFor, IMPORT_GUIDES } from "./guides";
import { IMPORT_APPS } from "./pipeline";

describe("다른 앱에서 가져오기 안내 (guides)", () => {
  it("앱은 선택 목록 순서대로 다섯 개이고 id가 겹치지 않는다", () => {
    expect(IMPORT_GUIDES.map((g) => g.id)).toEqual([
      "notion",
      "obsidian",
      "appflowy",
      "affine",
      "evernote",
    ]);
    expect(new Set(IMPORT_GUIDES.map((g) => g.label)).size).toBe(5);
  });

  it("pipeline의 IMPORT_APPS는 같은 원천을 가리킨다", () => {
    expect(IMPORT_APPS).toBe(IMPORT_GUIDES);
  });

  it("모든 앱은 단계·가져오는 것·가져오지 않는 것을 적는다", () => {
    for (const g of IMPORT_GUIDES) {
      expect(g.steps.length, g.id).toBeGreaterThanOrEqual(2);
      expect(g.gets.length, g.id).toBeGreaterThanOrEqual(1);
      expect(g.misses.length, g.id).toBeGreaterThanOrEqual(1);
      expect(g.hint.length, g.id).toBeGreaterThan(0);
    }
  });

  it("Notion은 zip만 받는다(압축을 풀지 않는다고 안내한다)", () => {
    const notion = guideFor("notion");
    expect(notion.kinds).toEqual(["zip"]);
    expect(notion.steps.join("\n")).toContain("압축은 풀지 마세요");
  });

  it("Obsidian은 폴더가 주 버튼이고 zip이 보조다", () => {
    expect(guideFor("obsidian").kinds).toEqual(["folder", "zip"]);
  });

  it("Evernote는 ENEX 파일을 고르고 메뉴 이름 주의를 적는다", () => {
    const g = guideFor("evernote");
    expect(g.kinds).toEqual(["enex"]);
    expect(g.note, "evernote").toContain("버전에 따라 다를 수 있어요");
  });

  it("AppFlowy·AFFiNE은 폴더가 주 버튼이고 확인하지 못한 메뉴 이름을 주의로 적는다", () => {
    for (const id of ["appflowy", "affine"] as const) {
      const g = guideFor(id);
      expect(g.kinds[0]).toBe("folder");
      expect(g.note, id).toContain("버전에 따라 다를 수 있어요");
    }
  });

  it("AFFiNE 원본 파일은 가져오지 않는다고 적는다", () => {
    expect(guideFor("affine").misses.join("\n")).toContain(".affine");
  });

  it("메뉴 경로는 「」로 감싼다(대화상자가 굵게 보여 준다)", () => {
    for (const g of IMPORT_GUIDES) {
      for (const s of g.steps) {
        expect(s.split("「").length - 1, s).toBe(s.split("」").length - 1);
      }
    }
  });
});
