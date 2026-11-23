/** 자동 확인 간격 — 앱이 켜져 있는 동안 하루에 한 번 (SYS-07) */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** "0.2.0", "v0.2.0", "0.2", "0.2.0-beta.1" → 본판 세 자리 + 프리릴리스 이름 */
export function parseVersion(text: string): { core: number[]; pre: string | null } | null {
  const m = /^v?(\d+(?:\.\d+){0,2})(?:-([0-9A-Za-z.-]+))?$/.exec(text.trim());
  if (!m) return null;
  const core = m[1].split(".").map(Number);
  while (core.length < 3) core.push(0);
  return { core, pre: m[2] ?? null };
}

/** latest가 current보다 새 버전이면 true. 해석할 수 없는 값은 새 버전이 아니다 */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i];
  }
  if (a.pre === b.pre) return false;
  // 같은 본판이면 정식판이 프리릴리스보다 새 것이다
  if (a.pre === null) return true;
  if (b.pre === null) return false;
  return a.pre > b.pre;
}

/** 마지막 확인 뒤 하루가 지났는지. 한 번도 안 했거나 시계가 뒤로 간 때도 확인한다 */
export function isCheckDue(lastCheckedAt: number | null, now: number): boolean {
  if (lastCheckedAt === null || now < lastCheckedAt) return true;
  return now - lastCheckedAt >= CHECK_INTERVAL_MS;
}
