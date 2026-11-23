import { createMemoryStorage, StorageError } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import { backupDate, backupErrorMessage, backupFileName, localDate, runAutoBackup } from ".";

describe("백업 (DATA-05)", () => {
  it("지역 날짜와 파일 이름", () => {
    const d = new Date(2026, 10, 9, 23, 30);
    expect(localDate(d)).toBe("2026-11-09");
    expect(backupFileName("내 노트", d)).toBe("내 노트 백업 2026-11-09.zip");
    expect(backupFileName("a/b: c?", d)).toBe("a b c 백업 2026-11-09.zip");
    expect(backupFileName(" .. ", d)).toBe("CetusNote 백업 2026-11-09.zip");
  });

  it("자동 백업 이름에서 날짜만 읽는다", () => {
    expect(backupDate("CetusNote-2026-11-19.zip")).toBe("2026-11-19");
    expect(backupDate("내가 둔 파일.zip")).toBeNull();
  });

  it("하루 한 번만 만들고 최근 7개만 남긴다", async () => {
    const storage = createMemoryStorage({ info: { name: "노트", path: "/memory/노트" } });
    const day = (n: number) => new Date(2026, 10, n, 9);
    expect(await runAutoBackup(storage, day(1))).toBe("CetusNote-2026-11-01.zip");
    expect(await runAutoBackup(storage, day(1))).toBeNull();
    for (let n = 2; n <= 9; n++) await runAutoBackup(storage, day(n));
    const list = await storage.listBackups();
    expect(list).toHaveLength(7);
    expect(list[0]).toBe("CetusNote-2026-11-09.zip");
    expect(list[list.length - 1]).toBe("CetusNote-2026-11-03.zip");
  });

  it("워크스페이스가 없으면 실패를 false로 돌려준다(던지지 않음)", async () => {
    const storage = createMemoryStorage({ info: null });
    expect(await runAutoBackup(storage)).toBe(false);
  });

  it("오류 문구", () => {
    expect(backupErrorMessage(new StorageError("invalid_backup", "x"))).toContain(
      "백업 파일이 아니",
    );
    expect(backupErrorMessage(new Error("x"))).toBe("백업하지 못했어요. 다시 시도해 주세요.");
  });
});
