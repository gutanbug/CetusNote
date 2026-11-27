import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import pending from "./pending.json";

/**
 * 번역 누락 검사 (SYS-14). 화면 코드에 한글 문자열을 직접 쓰지 않고 `useMessages()`/`msg()`로 읽는지 본다.
 * 주석은 보지 않는다. 일부러 남기는 한글(검색 별칭 등)은 그 줄이나 바로 윗줄에 `i18n-ignore`를 적는다.
 * 아직 옮기지 않은 파일은 pending.json에 있다 — 옮긴 파일은 목록에서 빼야 통과한다.
 */
const ROOT = join(__dirname, "../../..");
const SRC = join(ROOT, "src");
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/;

/** 한글이 있어도 되는 곳: 한국어 문구, 개발용 Debug 화면, 한국어 자체를 다루는 로직 */
const ALLOW = [
  "src/lib/i18n/ko/",
  "src/lib/i18n/index.ts",
  "src/debug/",
  "src/lib/calc/",
  "src/lib/hangul.ts",
  "src/lib/josa.ts",
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec|stories)\.|\.d\.ts$/.test(name)) return [];
    return [path];
  });
}

/** 파일에서 한글이 든 문자열·JSX 글의 줄 번호 */
function hangulLines(text: string, fileName = "x.tsx"): number[] {
  if (text.includes("i18n-ignore-file")) return [];
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const lines = text.split("\n");
  const out: number[] = [];
  const visit = (node: ts.Node) => {
    let value: string | null = null;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) value = node.text;
    else if (ts.isJsxText(node)) value = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
      value = node.text;
    if (value !== null && HANGUL.test(value)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      const ignored = [lines[line], lines[line - 1]].some((l) => l?.includes("i18n-ignore"));
      if (!ignored) out.push(line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function offenders(): Map<string, number[]> {
  const found = new Map<string, number[]>();
  for (const path of files(SRC)) {
    const rel = relative(ROOT, path).split("\\").join("/");
    if (ALLOW.some((a) => rel.startsWith(a))) continue;
    const lines = hangulLines(readFileSync(path, "utf8"), path);
    if (lines.length) found.set(rel, lines);
  }
  return found;
}

describe("번역 누락 검사 (SYS-14)", () => {
  it("문자열·JSX 글의 한글만 찾고 주석과 i18n-ignore는 건너뛴다", () => {
    const text = [
      "// 주석은 괜찮다",
      'const a = "한글";',
      "const b = `값 ${a}`;",
      "const d = <p>안녕</p>;",
      'const c = "별칭"; // i18n-ignore',
    ].join("\n");
    expect(hangulLines(text)).toEqual([2, 3, 4]);
  });

  it("옮기지 않은 파일은 pending.json에 있고, 옮긴 파일은 목록에서 빠져 있다", () => {
    const found = offenders();
    const listed = new Set<string>(pending);
    const unlisted = [...found.keys()].filter((f) => !listed.has(f));
    const done = [...listed].filter((f) => !found.has(f));
    expect(
      unlisted.map((f) => `${f}:${found.get(f)!.slice(0, 5).join(",")}`),
      "한글 문자열이 남은 파일 — useMessages()/msg()로 옮기거나 i18n-ignore",
    ).toEqual([]);
    expect(done, "다 옮긴 파일 — pending.json에서 빼기").toEqual([]);
  });
});
