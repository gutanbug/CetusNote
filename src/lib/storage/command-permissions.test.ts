import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rust 커맨드는 세 곳에 함께 적어야 앱에서 부를 수 있다:
 * lib.rs의 invoke_handler, build.rs의 COMMANDS, permissions/storage.toml.
 * 한 곳이라도 빠지면 Tauri가 호출을 거부한다(DATA-08 가져오기, DATA-06 PDF에서 겪음).
 */
const root = resolve(__dirname, "../../../src-tauri");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

// invoke_handler 목록 전체를 읽는다. `commands::x,`뿐 아니라 lib.rs에 직접 둔 `confirm_quit,` 같은 이름도 센다
const handlerBlock = read("src/lib.rs").match(/generate_handler!\[([\s\S]*?)\]\)/)?.[1] ?? "";
const handler = [...handlerBlock.matchAll(/(?:commands::)?([a-z_][a-z0-9_]*),/g)].map((m) => m[1]);
const listed = [
  ...(read("build.rs").match(/COMMANDS[^=]*=\s*&\[([\s\S]*?)\];/)?.[1] ?? "").matchAll(
    /"([a-z0-9_]+)"/g,
  ),
].map((m) => m[1]);
const allowed = [...read("permissions/storage.toml").matchAll(/"allow-([a-z0-9-]+)"/g)].map((m) =>
  m[1].replace(/-/g, "_"),
);

describe("Tauri 커맨드 권한", () => {
  it("세 목록을 읽는다", () => {
    expect(handler.length).toBeGreaterThan(10);
    expect(handler).toContain("confirm_quit");
  });
  it("invoke_handler와 build.rs COMMANDS가 같다", () => {
    expect([...listed].sort()).toEqual([...handler].sort());
  });
  it("storage.toml이 모든 커맨드를 허용한다", () => {
    expect([...allowed].sort()).toEqual([...handler].sort());
  });
});

describe("개발 설정의 권한 묶음 (QN-03)", () => {
  it("tauri.dev.conf.json이 capabilities/의 모든 파일을 포함한다", async () => {
    // 개발 설정은 권한 목록을 직접 적는다. 빠지면 개발 앱에서만 그 창의 커맨드가 모두 거부된다
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(resolve(root, "capabilities"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(resolve(root, "capabilities", f), "utf8")).identifier);
    const dev = JSON.parse(readFileSync(resolve(root, "tauri.dev.conf.json"), "utf8"));
    const listed = (dev.app.security.capabilities as unknown[]).filter(
      (c): c is string => typeof c === "string",
    );
    expect(files.filter((id) => !listed.includes(id))).toEqual([]);
  });
});
