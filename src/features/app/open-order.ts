/**
 * 워크스페이스를 연 뒤 그 폴더를 읽는 순서 (SYS-09).
 *
 * 데스크탑·문서 같은 보호 폴더는 macOS가 처음 읽을 때 권한 대화상자를 띄운다.
 * 여러 요청이 같은 폴더를 동시에 읽으면 대화상자가 요청마다 뜰 수 있으므로,
 * 단계를 하나씩 끝낸 뒤 다음 단계를 시작한다. 지연은 넣지 않는다.
 */
export type OpenStep = (workspacePath: string) => Promise<unknown>;

/** 단계를 순서대로 기다린다. 한 단계가 실패해도 다음 단계는 계속한다(각 스토어가 자기 오류를 처리한다) */
export async function loadWorkspaceInOrder(
  workspacePath: string,
  steps: readonly OpenStep[],
): Promise<void> {
  for (const step of steps) {
    try {
      await step(workspacePath);
    } catch {
      // 다음 단계로 간다
    }
  }
}
