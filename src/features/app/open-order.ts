/**
 * 워크스페이스를 연 뒤 그 폴더를 읽는 순서 (SYS-09).
 *
 * 데스크탑·문서 같은 보호 폴더는 macOS가 처음 읽을 때 권한 대화상자를 띄운다.
 * 여러 요청이 같은 폴더를 동시에 읽으면 대화상자가 요청마다 뜰 수 있으므로,
 * 단계를 하나씩 끝낸 뒤 다음 단계를 시작한다. 지연은 넣지 않는다.
 */
export type OpenStep = (workspacePath: string) => Promise<unknown>;

/**
 * 단계를 순서대로 기다린다. 한 단계가 실패해도 다음 단계는 계속한다(각 스토어가 자기 오류를 처리한다).
 * 돌려주는 값은 모든 단계가 성공했는지다.
 */
export async function loadWorkspaceInOrder(
  workspacePath: string,
  steps: readonly OpenStep[],
): Promise<boolean> {
  let ok = true;
  for (const step of steps) {
    try {
      await step(workspacePath);
    } catch {
      ok = false;
    }
  }
  return ok;
}

/**
 * 워크스페이스 열기가 끝나 “읽기 준비 완료”인 경로. 자동 백업·바깥 변경 확인은 이 뒤에만 폴더를 읽는다.
 * 페이지 목록을 읽지 못했는데 백업을 만들면 빈 상태를 백업하게 되므로, 실패한 열기는 준비 완료로 보지 않는다 (SYS-09).
 */
export function createLaunchGate() {
  let readyPath: string | null = null;
  const listeners = new Set<() => void>();
  return {
    isReady: (path: string) => readyPath === path,
    reset() {
      readyPath = null;
    },
    markReady(path: string) {
      readyPath = path;
      listeners.forEach((f) => f());
    },
    onReady(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type LaunchGate = ReturnType<typeof createLaunchGate>;

/** 단계를 기다린 뒤 모두 성공했고 아직 현재 워크스페이스면 준비 완료로 표시한다. 성공 여부를 돌려준다 */
export async function openWorkspaceForLaunch(
  workspacePath: string,
  steps: readonly OpenStep[],
  gate: LaunchGate,
  isCurrent: () => boolean,
): Promise<boolean> {
  const ok = await loadWorkspaceInOrder(workspacePath, steps);
  if (ok && isCurrent()) gate.markReady(workspacePath);
  return ok;
}
