import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FILE_MAX_BYTES, MEDIA_MAX_BYTES, attachmentKind, extensionOf } from "./limits";

/**
 * 크기 상한은 두 곳에 있다: 이 폴더(TS, 화면 표시)와 Rust `storage/attachments.rs`(저장 검사).
 * 같은 값인지 Rust 소스에서 읽어 비교한다. 한쪽만 바꾸면 이 테스트가 실패한다.
 */
const rust = readFileSync(
  resolve(__dirname, "../../../src-tauri/src/storage/attachments.rs"),
  "utf8",
);

/** `pub const NAME: u64 = 25 * 1024 * 1024;` 형태의 값을 숫자로 계산 */
function rustConst(name: string): number {
  const m = rust.match(new RegExp(`pub const ${name}: u64 = ([0-9 *]+);`));
  if (!m) throw new Error(`Rust 상수를 찾지 못했어요: ${name}`);
  return m[1]!
    .split("*")
    .map((n) => Number(n.trim()))
    .reduce((a, b) => a * b, 1);
}

describe("첨부 크기 상한 (TS ↔ Rust)", () => {
  it("파일 상한이 같다", () => {
    expect(FILE_MAX_BYTES).toBe(rustConst("FILE_MAX_BYTES"));
  });
  it("영상·소리 상한이 같다", () => {
    expect(MEDIA_MAX_BYTES).toBe(rustConst("MEDIA_MAX_BYTES"));
  });
});

describe("첨부 종류 판별 (Rust kind_of와 같은 규칙)", () => {
  it("확장자 · MIME 규칙", () => {
    expect(attachmentKind("a.PDF")).toBe("pdf");
    expect(attachmentKind("clip.mov")).toBe("video");
    expect(attachmentKind("song.flac")).toBe("audio");
    expect(attachmentKind("data.zip")).toBe("file");
    expect(attachmentKind(".pdf")).toBe("file");
    expect(attachmentKind("weird.bin", "video/mp4")).toBe("video");
    expect(extensionOf("noext")).toBe("");
  });
});
