/**
 * 워크스페이스를 바꾸기 전에 남은 저장을 모두 끝낸다 (DATA-03).
 * 페이지 대기열, 화면 상태(settings.json), workspace.json 순서로 쓴다.
 * 하나라도 쓰지 못하면 false — 그러면 워크스페이스는 바뀌지 않는다(부르는 쪽이 알린다).
 * 한 번도 읽지 않은 workspace.json(meta가 null)은 쓸 것이 없으므로 통과한다.
 */
type Flushable<S> = { getState(): S };

export type WriteGuardStores = {
  pages: Flushable<{ flushAll(): Promise<boolean> }>;
  session: Flushable<{ flush(): Promise<void> }>;
  meta: Flushable<{ meta: unknown; flush(): Promise<boolean> }>;
};

export function createWorkspaceWriteGuard({ pages, session, meta }: WriteGuardStores) {
  return async (): Promise<boolean> => {
    const pagesOk = await pages.getState().flushAll();
    await session.getState().flush();
    const m = meta.getState();
    const metaOk = m.meta ? await m.flush() : true;
    return pagesOk && metaOk;
  };
}
