import { useEffect } from "react";
import { listenAppEvent } from "@/lib/storage/quick-events";
import { remindersStore } from "@/features/reminders";
import { metaStore } from "@/features/meta";
import { pagesStore } from "@/features/pages";
import { openPageLink } from "./actions";

/**
 * 빠른 입력 창(QN-03)과의 연결. 빠른 입력이 페이지를 열어 달라고 하면 연다,
 * 빠른 입력이 알림·메모·페이지를 쓰면 메인 창의 스토어를 다시 읽는다.
 */
export function useQuickBridge() {
  useEffect(() => {
    const subs = [
      listenAppEvent<{ id: string }>("quick://open-page", ({ id }) => openPageLink(id)),
      listenAppEvent("reminders://changed", () => void remindersStore.getState().load()),
      listenAppEvent("quick://changed", () => {
        void metaStore.getState().load();
        void pagesStore.getState().load();
      }),
    ];
    return () => {
      subs.forEach((p) => void p.then((off) => off()));
    };
  }, []);
}
