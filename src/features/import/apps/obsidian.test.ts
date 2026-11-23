import { describe, expect, it } from "vitest";
import { convertObsidianVault } from "./obsidian";
import type { SourceFile } from "./tree";

const f = (path: string, text = ""): SourceFile => ({ path, text });
const byKey = <T extends { key: string }>(nodes: T[], key: string): T =>
  nodes.find((n) => n.key === key)!;

describe("Obsidian 보관소 가져오기 (DATA-11)", () => {
  it(".obsidian · .trash · 점 파일은 건너뛰고 폴더는 계층으로 만든다", () => {
    const { nodes } = convertObsidianVault([
      f(".obsidian/app.json", "{}"),
      f(".trash/old.md", "x"),
      f(".hidden.md", "x"),
      f("일기/2026-11-23.md", "오늘"),
    ]);
    const folder = byKey(nodes, "d:일기");
    expect(folder.kind).toBe("folder");
    expect(folder.parentKey).toBeNull();
    const note = byKey(nodes, "p:일기/2026-11-23");
    expect(note.parentKey).toBe("d:일기");
    expect(nodes).toHaveLength(2);
  });

  it("같은 이름의 노트가 있는 폴더는 그 노트 아래에 붙는다 (폴더 노트)", () => {
    const { nodes } = convertObsidianVault([f("프로젝트.md", "a"), f("프로젝트/할일.md", "b")]);
    expect(byKey(nodes, "p:프로젝트/할일").parentKey).toBe("p:프로젝트");
    expect(nodes.some((n) => n.kind === "folder")).toBe(false);
  });

  it("front matter의 title·tags·aliases를 읽고 title이 없으면 파일 이름을 쓴다", () => {
    const text = [
      "---",
      "title: 회의록, 1차",
      "tags:",
      "  - #팀",
      "  - 회의",
      "aliases: [a, b]",
      "---",
      "본문 #프로젝트/A",
    ].join("\n");
    const { nodes } = convertObsidianVault([f("회의.md", text), f("메모.md", "그냥")]);
    const meeting = byKey(nodes, "p:회의");
    expect(meeting.title).toBe("회의록, 1차");
    expect(meeting.tags).toEqual(["팀", "회의", "프로젝트/A"]);
    expect(meeting.markdown).not.toContain("---");
    expect(byKey(nodes, "p:메모").title).toBe("메모");
  });

  it("위키링크는 노트 링크가 되고, 별칭·제목 앵커를 처리하며, 못 찾으면 글자만 남긴다", () => {
    const { nodes } = convertObsidianVault([
      f("a/목표.md", ""),
      f("b.md", "[[목표]] · [[목표|별칭]] · [[목표#설명]] · [[없는노트]] · [[없는노트|이름]]"),
    ]);
    const md = byKey(nodes, "p:b").markdown;
    expect(md).toContain('<a data-page-mention="p:a/목표">목표</a>');
    expect(md).toContain('<a data-page-mention="p:a/목표">별칭</a>');
    expect(md).toContain('<a data-page-mention="p:a/목표">목표</a> · <a');
    expect(md).toContain("없는노트");
    expect(md).toContain("이름");
    expect(md).not.toContain("[[");
  });

  it("같은 이름이 여러 개면 가장 얕은 경로를 고르고, 같은 폴더 기준 상대 경로를 먼저 본다", () => {
    const { nodes } = convertObsidianVault([
      f("깊은/폴더/목표.md", ""),
      f("목표.md", ""),
      f("폴더/x.md", "[[목표]]"),
      f("폴더/목표.md", ""),
    ]);
    expect(byKey(nodes, "p:폴더/x").markdown).toContain('data-page-mention="p:폴더/목표"');
    expect(byKey(nodes, "p:목표").markdown).toBe("");
  });

  it("그림 임베드는 보관소 안에서 이름으로 찾아 자산으로 모으고, 크기 표시는 버린다", () => {
    const { nodes } = convertObsidianVault([
      f("첨부/사진.png", "PNG"),
      f("노트.md", "![[사진.png|300]] 그리고 ![[없음.jpg]]"),
    ]);
    const note = byKey(nodes, "p:노트");
    expect(note.markdown).toContain("![](<첨부/사진.png>)");
    expect(note.markdown).toContain("없음.jpg");
    expect(note.assetPaths).toEqual(["첨부/사진.png"]);
  });

  it("노트 임베드는 링크로 바뀐다", () => {
    const { nodes } = convertObsidianVault([f("가.md", ""), f("나.md", "![[가]]")]);
    expect(byKey(nodes, "p:나").markdown).toContain('data-page-mention="p:가"');
  });

  it("콜아웃은 색·이모지가 있는 callout 블록이 된다", () => {
    const text = [
      "> [!warning]- 조심",
      "> 물을 **많이** 마세요",
      "> 두 번째 줄",
      "",
      "다음 문단",
    ].join("\n");
    const { nodes } = convertObsidianVault([f("c.md", text)]);
    const md = byKey(nodes, "p:c").markdown;
    expect(md).toContain('data-type="callout" data-emoji="⚠️" data-color="orange"');
    expect(md).toContain("<p>조심</p>");
    expect(md).toContain("<p>두 번째 줄</p>");
    expect(md).toContain("다음 문단");
  });

  it("알 수 없는 콜아웃 종류는 회색 기본값을 쓴다", () => {
    const { nodes } = convertObsidianVault([f("c.md", "> [!weird]\n> 글")]);
    expect(byKey(nodes, "p:c").markdown).toContain('data-color="gray"');
  });

  it("코드 블록과 인라인 코드 안의 [[ ]]·#태그는 건드리지 않는다", () => {
    const text = [
      "```md",
      "[[목표]] #코드태그",
      "```",
      "`#인라인` [[목표]] #진짜태그",
      "# 제목 #제목태그",
    ].join("\n");
    const { nodes } = convertObsidianVault([f("목표.md", ""), f("c.md", text)]);
    const note = byKey(nodes, "p:c");
    expect(note.markdown).toContain("[[목표]] #코드태그");
    expect(note.markdown).toContain("`#인라인`");
    expect(note.markdown).toContain('data-page-mention="p:목표"');
    expect(note.tags).toEqual(["진짜태그"]);
  });

  it("숫자만 있는 #태그와 주소 속 #은 태그가 아니다, BOM·CRLF도 읽는다", () => {
    const { nodes } = convertObsidianVault([f("c.md", "﻿#123 https://x.y/#frag #좋음\r\n")]);
    const note = byKey(nodes, "p:c");
    expect(note.tags).toEqual(["좋음"]);
    expect(note.markdown).not.toContain("\r");
  });

  it("경로가 안전하지 않으면 건너뛰고 목록에 남긴다", () => {
    const { nodes, skipped } = convertObsidianVault([
      f("../밖.md", "x"),
      f("/abs.md", "x"),
      f("ok.md", "y"),
    ]);
    expect(skipped).toEqual(["../밖.md", "/abs.md"]);
    expect(nodes.map((n) => n.key)).toEqual(["p:ok"]);
  });
});
