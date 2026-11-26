#!/usr/bin/env node
// 버전의 릴리스 노트를 CHANGELOG.md에서 꺼내 표준 출력에 쓴다 (SYS-12).
// 릴리스 워크플로가 GitHub Release 본문과 latest.json의 notes로 쓴다. 섹션이 없거나 비어 있으면 실패한다.
//
//   node scripts/release-notes.mjs v0.2.0 > notes.md
//   node scripts/release-notes.mjs 0.2.0            (v는 있어도 없어도 된다)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractSection } from "./changelog.mjs";

export const CHANGELOG_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "CHANGELOG.md");

/** 「v0.2.0」·「0.2.0」 → 「0.2.0」. 형식이 맞지 않으면 실패한다 */
export function versionFromTag(tag) {
  const version = String(tag).replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`버전 형식이 아니에요: ${tag}`);
  return version;
}

/** 릴리스 노트 본문. changelogPath를 바꿔 테스트할 수 있다 */
export function releaseNotes(tag, changelogPath = CHANGELOG_PATH) {
  return extractSection(readFileSync(changelogPath, "utf8"), versionFromTag(tag));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tag = process.argv[2];
  if (!tag) {
    console.error("사용법: node scripts/release-notes.mjs v0.2.0");
    process.exit(1);
  }
  try {
    process.stdout.write(`${releaseNotes(tag)}\n`);
  } catch (error) {
    console.error(`릴리스 노트를 만들지 못했어요: ${error.message}`);
    process.exit(1);
  }
}
