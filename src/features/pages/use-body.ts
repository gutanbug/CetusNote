import * as React from "react";
import { pagesStore, usePages } from "./index";
import { isBodyLoaded } from "./body";

/**
 * 페이지 본문이 올라왔는지 (SYS-10, ADR-022). 아직이면 읽기를 시작하고, 올라오면 true가 된다.
 * 없는 페이지는 false이고 아무것도 읽지 않는다.
 */
export function useBodyLoaded(id: string | null | undefined): boolean {
  const loaded = usePages((s) => {
    const page = id ? s.pages[id] : undefined;
    return !!page && isBodyLoaded(page);
  });
  const exists = usePages((s) => (id ? !!s.pages[id] : false));
  React.useEffect(() => {
    if (!id || loaded || !exists) return;
    void pagesStore.getState().ensureBody(id);
  }, [id, loaded, exists]);
  return loaded;
}
