// CHANGELOG.md 읽기·옮기기 (Keep a Changelog 1.1.0). 릴리스 노트의 단일 출처다.
//
//   extractSection(md, "0.2.0")        버전 섹션의 본문(Markdown). 없거나 비어 있으면 던진다
//   promoteUnreleased(md, { version, date })
//                                      [Unreleased] 본문을 「## [x.y.z] - 날짜」 섹션으로 옮기고 비교 링크를 고친다
//
// scripts/version.mjs(버전 올리기)와 scripts/release-notes.mjs(릴리스 노트 추출)가 쓴다.
// 앱 안의 「릴리스 노트 보기」는 src/features/release-notes/changelog.ts가 같은 규칙으로 읽는다.

const VERSION_HEADING = /^## \[([^\]]+)\]/;
const LINK_REF = /^\[[^\]]+\]:\s+\S/;
const UNRELEASED_LINK = /^\[Unreleased\]:\s+(.+)\/compare\/(\S+?)\.\.\.HEAD\s*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

/** 「## [...]」 제목 줄이 아닌 것까지 포함해, 주어진 줄 번호 뒤에서 다음 버전 제목이나 링크 정의 블록의 시작 줄을 찾는다 */
function sectionEnd(lines, from) {
  for (let i = from; i < lines.length; i++) {
    if (VERSION_HEADING.test(lines[i]) || LINK_REF.test(lines[i])) return i;
  }
  return lines.length;
}

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  return lines.slice(start, end);
}

/** 제목만 있고 항목이 없으면 비어 있는 것으로 본다 */
function hasEntries(lines) {
  return lines.some((line) => line.trim() !== "" && !/^#{1,6}\s/.test(line));
}

function findVersionLine(lines, name) {
  return lines.findIndex((line) => {
    const m = VERSION_HEADING.exec(line);
    return m !== null && m[1] === name;
  });
}

/** 「## [version]」 섹션의 본문을 돌려준다. 섹션이 없거나 비어 있으면 실패한다 */
export function extractSection(markdown, version) {
  const lines = markdown.split("\n");
  const at = findVersionLine(lines, version);
  if (at < 0) {
    throw new Error(
      `CHANGELOG.md에 ${version} 섹션이 없어요. 릴리스 전에 변경 내용을 적어 주세요.`,
    );
  }
  const body = trimBlankLines(lines.slice(at + 1, sectionEnd(lines, at + 1))).join("\n");
  if (!hasEntries(lines.slice(at + 1, sectionEnd(lines, at + 1)))) {
    throw new Error(`CHANGELOG.md의 ${version} 섹션이 비어 있어요.`);
  }
  return body;
}

/**
 * [Unreleased] 본문을 새 버전 섹션으로 옮긴다. 본문이 비었거나 같은 버전 섹션이 이미 있으면 실패한다.
 * 비교 링크는 [Unreleased]를 새 태그 기준으로 바꾸고, 「[x.y.z]: 이전…새 버전」 링크를 그 아래에 넣는다.
 */
export function promoteUnreleased(markdown, { version, date }) {
  if (!SEMVER.test(version)) throw new Error(`버전 "${version}"은 X.Y.Z 형식이어야 해요.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error(`날짜 "${date}"는 YYYY-MM-DD 형식이어야 해요.`);
  const lines = markdown.split("\n");
  const unreleased = findVersionLine(lines, "Unreleased");
  if (unreleased < 0) throw new Error("CHANGELOG.md에 ## [Unreleased] 섹션이 없어요.");
  if (findVersionLine(lines, version) >= 0) {
    throw new Error(`CHANGELOG.md에 이미 ${version} 섹션이 있어요.`);
  }
  const next = sectionEnd(lines, unreleased + 1);
  const body = trimBlankLines(lines.slice(unreleased + 1, next));
  if (!hasEntries(body)) {
    throw new Error(
      "CHANGELOG.md의 [Unreleased]가 비어 있어요. 릴리스 전에 변경 내용을 적어 주세요.",
    );
  }

  const out = [
    ...lines.slice(0, unreleased + 1),
    "",
    `## [${version}] - ${date}`,
    "",
    ...body,
    "",
    ...lines.slice(next),
  ];

  // 비교 링크: [Unreleased]는 새 태그부터, 새 버전 링크는 이전 태그와 새 태그를 잇는다
  const linkAt = out.findIndex((line) => UNRELEASED_LINK.test(line));
  if (linkAt >= 0) {
    const m = UNRELEASED_LINK.exec(out[linkAt]);
    const [, base, previousTag] = m;
    out.splice(
      linkAt,
      1,
      `[Unreleased]: ${base}/compare/v${version}...HEAD`,
      `[${version}]: ${base}/compare/${previousTag}...v${version}`,
    );
  }
  return out.join("\n");
}

/** 오늘 날짜를 로컬 기준 YYYY-MM-DD로 */
export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
