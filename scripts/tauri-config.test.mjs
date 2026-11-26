import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 개발 실행(`pnpm app`)은 tauri.dev.conf.json을 기본 설정 위에 병합한다. 식별자가 같으면
// 개발 빌드와 설치된 릴리스 앱이 ~/Library/Application Support/<식별자>와 웹뷰 데이터를 함께 쓴다 (SYS-13).
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri");
const read = (name) => JSON.parse(readFileSync(join(SRC, name), "utf8"));

describe("Tauri 설정 식별자 (SYS-13)", () => {
  const release = read("tauri.conf.json").identifier;
  const dev = read("tauri.dev.conf.json").identifier ?? release;

  it("릴리스 식별자는 바뀌지 않는다 (설치된 사용자의 설정·권한을 지키려고)", () => {
    expect(release).toBe("dev.cetusnote.app");
  });

  it("개발 실행은 릴리스와 다른 식별자로 데이터를 따로 쓴다", () => {
    expect(dev).not.toBe(release);
    expect(dev.startsWith(`${release}.`)).toBe(true);
  });

  it("개발 실행 이름은 (Dev)를 붙인다", () => {
    expect(read("tauri.dev.conf.json").productName).toMatch(/\(Dev\)$/);
  });
});
