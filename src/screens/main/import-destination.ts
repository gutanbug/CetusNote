import { create } from "zustand";

/** 가져오기 목적지 질문 — 답이 오면 resolve, 취소하면 null */
export type ImportChoice = { parentId: string | null };

type Pending = { count: number; resolve: (choice: ImportChoice | null) => void };

/** 「어디에 넣을까요?」 대화상자 상태 (저장하지 않는다). 대화상자는 메인 화면에 하나만 붙는다 */
export const useImportDestination = create<{ pending: Pending | null }>(() => ({ pending: null }));

/** 파일 수 count만큼 가져올 문서의 목적지를 묻는다. 취소하면 null */
export function askImportDestination(count: number): Promise<ImportChoice | null> {
  return new Promise((resolve) => {
    // 이전 질문이 아직 남아 있으면 취소로 끝낸다
    useImportDestination.getState().pending?.resolve(null);
    useImportDestination.setState({ pending: { count, resolve } });
  });
}

export function answerImportDestination(parentId: string | null) {
  const { pending } = useImportDestination.getState();
  if (!pending) return;
  useImportDestination.setState({ pending: null });
  pending.resolve({ parentId });
}

export function cancelImportDestination() {
  const { pending } = useImportDestination.getState();
  if (!pending) return;
  useImportDestination.setState({ pending: null });
  pending.resolve(null);
}
