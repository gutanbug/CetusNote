#!/usr/bin/env node
// 버전의 릴리스 노트를 CHANGELOG.md에서 꺼내 표준 출력에 쓴다 (SYS-12).
// 릴리스 워크플로가 GitHub Release 본문과 latest.json의 notes로 쓴다. 섹션이 없거나 비어 있으면 실패한다.
//
//   node scripts/release-notes.mjs v0.2.0 > notes.md
//   node scripts/release-notes.mjs 0.2.0            (v는 있어도 없어도 된다)
//   node scripts/release-notes.mjs v0.2.0 --with-footer   (설치 안내 꼬리말을 붙인다 — 실제 릴리스용)
// 릴리스 설치 안내 문구는 여기 한 곳에만 있다. .github/workflows/release.yml과 scripts/release-local.sh가 이 플래그를 쓴다.
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

/** GitHub Release 본문 꼬리말 (설치 안내). 워크플로와 로컬 릴리스가 같은 문구를 쓴다 */
export const RELEASE_FOOTER =
  [
    "",
    "---",
    "",
    "이미 설치한 앱은 설정 › 일반 › 업데이트에서 바로 업데이트할 수 있어요.",
    "처음 설치하는 경우 서명이 없어서 macOS는 우클릭 › 열기, Windows는 SmartScreen의 「추가 정보 › 실행」으로 열어 주세요.",
  ].join("\n") + "\n";

/** 릴리스 노트 본문 + (옵션) 꼬리말. 출력은 항상 줄바꿈으로 끝난다 */
export function releaseNotesWithFooter(tag, changelogPath = CHANGELOG_PATH) {
  return `${releaseNotes(tag, changelogPath)}\n${RELEASE_FOOTER}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const withFooter = args.includes("--with-footer");
  const tag = args.find((a) => !a.startsWith("--"));
  if (!tag) {
    console.error("사용법: node scripts/release-notes.mjs v0.2.0 [--with-footer]");
    process.exit(1);
  }
  try {
    if (withFooter) process.stdout.write(releaseNotesWithFooter(tag));
    else process.stdout.write(`${releaseNotes(tag)}\n`);
  } catch (error) {
    console.error(`릴리스 노트를 만들지 못했어요: ${error.message}`);
    process.exit(1);
  }
}
