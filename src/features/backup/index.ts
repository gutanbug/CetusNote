import { msg } from "@/lib/i18n";
import { StorageError, type Storage } from "@/lib/storage";

/**
 * 워크스페이스 백업 (DATA-05, 2026-11-19 사용자 결정).
 * - 수동: 설정 → 데이터에서 원하는 곳에 zip
 * - 자동: 워크스페이스를 열 때 하루 한 번 `.backups/`에 (최근 7개). 설정에서 끌 수 있다
 * - 복원: 백업을 새 폴더에 풀어 그 폴더를 연다(지금 워크스페이스는 그대로)
 */

/** 지역 날짜 YYYY-MM-DD */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 수동 백업 기본 파일 이름: "<워크스페이스> 백업 2026-11-19.zip" (파일 이름에 못 쓰는 글자는 뺀다) */
export function backupFileName(workspaceName: string, now: Date): string {
  const safe =
    workspaceName
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s.]+|[\s.]+$/g, "")
      .slice(0, 60) || "CetusNote";
  return msg().features.backup.fileName(safe, localDate(now));
}

/** 자동 백업 이름 → 날짜 (`CetusNote-2026-11-19.zip` → "2026-11-19") */
export function backupDate(fileName: string): string | null {
  return /^CetusNote-(\d{4}-\d{2}-\d{2})\.zip$/.exec(fileName)?.[1] ?? null;
}

export function backupErrorMessage(e: unknown): string {
  const code = e instanceof StorageError ? e.code : "io";
  switch (code) {
    case "invalid_backup":
      return msg().features.backup.notBackupFile;
    case "too_large":
      return msg().features.backup.entryTooLarge;
    case "invalid_path":
      return msg().features.backup.insideWorkspace;
    case "permission_denied":
      return msg().features.backup.notWritable;
    case "disk_full":
      return msg().features.backup.noSpace;
    default:
      return msg().features.backup.failed;
  }
}

/** 하루 한 번 자동 백업. 만들었으면 파일 이름, 오늘 것이 있으면 null. 실패해도 던지지 않고 false */
export async function runAutoBackup(
  storage: Storage,
  now = new Date(),
): Promise<string | null | false> {
  try {
    return await storage.autoBackup(localDate(now), now.toISOString());
  } catch {
    return false;
  }
}
