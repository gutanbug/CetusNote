#!/usr/bin/env node
// 업데이트 목록(latest.json)을 릴리스의 .sig 파일들로 만든다 (SYS-07, SYS-08).
// 세 OS 작업이 같은 릴리스에 올린 서명 파일을 한 번에 모은다. tauri-action이 작업마다 latest.json을 덮어쓰지 않게 하려고 따로 만든다.
//
// 사용: node scripts/make-latest-json.mjs --tag v0.1.2 --dir <.sig 폴더> --repo owner/name --out latest.json
// 세 플랫폼(macOS · Windows · Linux)이 모두 있어야 성공한다. 하나라도 없으면 실패해서 불완전한 목록이 올라가지 않게 한다.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** 번들 이름 → 업데이트 플랫폼 키. 위에서부터 맞는 첫 규칙을 쓴다 */
const RULES = [
  { test: /\.app\.tar\.gz$/, keys: ["darwin-aarch64", "darwin-x86_64"] },
  { test: /\.AppImage\.tar\.gz$/, keys: ["linux-x86_64"] },
  { test: /-setup\.exe$/, keys: ["windows-x86_64"] },
  { test: /\.nsis\.zip$/, keys: ["windows-x86_64"] },
];
const REQUIRED = ["darwin-aarch64", "windows-x86_64", "linux-x86_64"];

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`${name} 값이 필요해요`);
  return process.argv[i + 1];
}

/** .sig 파일 목록 → platforms 객체. 같은 키에 여러 번이면 실패한다 */
export function buildPlatforms(sigFiles, { repo, tag, read = (p) => readFileSync(p, "utf8") }) {
  const platforms = {};
  for (const { name, path } of sigFiles) {
    const bundle = name.replace(/\.sig$/, "");
    const rule = RULES.find((r) => r.test.test(bundle));
    if (!rule) continue;
    const signature = read(path).trim();
    if (!signature) throw new Error(`서명이 비어 있어요: ${name}`);
    const url = `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(bundle)}`;
    for (const key of rule.keys) {
      if (platforms[key]) throw new Error(`같은 플랫폼이 두 번 있어요: ${key} (${bundle})`);
      platforms[key] = { signature, url };
    }
  }
  for (const key of REQUIRED) {
    if (!platforms[key]) throw new Error(`서명 파일이 없어요: ${key}`);
  }
  return platforms;
}

function main() {
  const tag = arg("--tag");
  const dir = arg("--dir");
  const repo = arg("--repo");
  const out = arg("--out");
  if (!/^v\d+\.\d+\.\d+/.test(tag)) throw new Error(`태그 형식이 아니에요: ${tag}`);
  const version = tag.slice(1);
  const sigFiles = readdirSync(dir)
    .filter((name) => name.endsWith(".sig"))
    .map((name) => ({ name, path: join(dir, name) }));
  const platforms = buildPlatforms(sigFiles, { repo, tag });
  const doc = {
    version,
    notes: `Cetus Note ${tag}`,
    pub_date: new Date().toISOString(),
    platforms,
  };
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`latest.json: ${Object.keys(platforms).join(", ")} (${version})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`latest.json을 만들지 못했어요: ${error.message}`);
    process.exitCode = 1;
  }
}
