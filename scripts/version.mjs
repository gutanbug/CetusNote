#!/usr/bin/env node
// 앱 버전을 한 번에 맞춘다 (SYS-07). 대상: package.json · src-tauri/Cargo.toml · src-tauri/tauri.conf.json · Cargo.lock
//
//   node scripts/version.mjs 0.2.0            세 파일 + Cargo.lock을 0.2.0으로 바꾼다
//   node scripts/version.mjs --check v0.2.0   네 파일이 모두 0.2.0인지 확인한다(릴리스 워크플로가 쓴다). 다르면 실패
//
// 바꾼 뒤에는 `cd src-tauri && cargo check`로 Cargo.lock을 확인하고, 커밋 메시지에 버전을 적는다.
// CHANGELOG.md의 [Unreleased]가 비어 있으면 아무 파일도 바꾸지 않고 실패한다(SYS-12).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promoteUnreleased, today } from "./changelog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  packageJson: join(root, "package.json"),
  cargoToml: join(root, "src-tauri/Cargo.toml"),
  tauriConf: join(root, "src-tauri/tauri.conf.json"),
  cargoLock: join(root, "src-tauri/Cargo.lock"),
  changelog: join(root, "CHANGELOG.md"),
};

const SEMVER = /^\d+\.\d+\.\d+$/;

/** 파일마다 버전이 적힌 자리를 찾는 규칙 */
const patterns = {
  // [package] 섹션의 version 줄(줄 맨 앞). 의존성 항목의 version = "..."은 줄 맨 앞이 아니다
  cargoToml: /^version = "([^"]*)"/m,
  // tauri.conf.json 최상위 "version" (파일에서 가장 먼저 나온다)
  tauriConf: /^(\s*"version":\s*)"([^"]*)"/m,
  // Cargo.lock의 cetusnote 패키지 항목
  cargoLock: /(name = "cetusnote"\nversion = ")([^"]*)(")/,
};

function readVersions() {
  const pkg = JSON.parse(readFileSync(files.packageJson, "utf8"));
  const cargo = readFileSync(files.cargoToml, "utf8").match(patterns.cargoToml);
  const conf = readFileSync(files.tauriConf, "utf8").match(patterns.tauriConf);
  const lock = readFileSync(files.cargoLock, "utf8").match(patterns.cargoLock);
  return {
    "package.json": pkg.version,
    "src-tauri/Cargo.toml": cargo?.[1],
    "src-tauri/tauri.conf.json": conf?.[2],
    "src-tauri/Cargo.lock": lock?.[2],
  };
}

function check(tag) {
  const want = tag.replace(/^v/, "");
  if (!SEMVER.test(want)) fail(`태그 "${tag}"는 vX.Y.Z 형식이 아니에요.`);
  const found = readVersions();
  const bad = Object.entries(found).filter(([, v]) => v !== want);
  if (bad.length) {
    const lines = Object.entries(found).map(([f, v]) => `  ${f}: ${v ?? "(찾지 못함)"}`);
    fail(
      `태그 ${tag}와 버전 파일이 달라요. 먼저 node scripts/version.mjs ${want} 를 실행해 주세요.\n${lines.join("\n")}`,
    );
  }
  console.log(`버전 ${want}: 네 파일이 모두 맞아요.`);
}

function set(version) {
  if (!SEMVER.test(version)) fail(`버전 "${version}"은 X.Y.Z 형식이어야 해요. 예: 0.2.0`);
  // 릴리스 노트: [Unreleased]를 새 버전 섹션으로 옮긴다(SYS-12). 실패하면 아무 파일도 바꾸지 않는다
  let changelog;
  try {
    changelog = promoteUnreleased(readFileSync(files.changelog, "utf8"), {
      version,
      date: today(),
    });
  } catch (error) {
    fail(error.message);
  }

  const pkg = JSON.parse(readFileSync(files.packageJson, "utf8"));
  pkg.version = version;
  writeFileSync(files.packageJson, `${JSON.stringify(pkg, null, 2)}\n`);

  replaceFirst(files.cargoToml, patterns.cargoToml, `version = "${version}"`);
  replaceFirst(files.tauriConf, patterns.tauriConf, `$1"${version}"`);
  replaceFirst(files.cargoLock, patterns.cargoLock, `$1${version}$3`);
  writeFileSync(files.changelog, changelog);
  console.log(
    `버전을 ${version}으로 맞췄어요. CHANGELOG.md의 [Unreleased]를 ${version} 섹션으로 옮겼어요. Cargo.lock은 cargo check로 한 번 확인해 주세요.`,
  );
}

function replaceFirst(path, pattern, replacement) {
  const text = readFileSync(path, "utf8");
  if (!pattern.test(text)) fail(`${path}에서 버전 자리를 찾지 못했어요.`);
  writeFileSync(path, text.replace(pattern, replacement));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [arg, value] = process.argv.slice(2);
if (arg === "--check") {
  if (!value) fail("사용법: node scripts/version.mjs --check v0.2.0");
  check(value);
} else if (arg) {
  set(arg);
} else {
  fail("사용법: node scripts/version.mjs 0.2.0  |  node scripts/version.mjs --check v0.2.0");
}
