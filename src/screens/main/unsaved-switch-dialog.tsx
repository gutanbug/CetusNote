import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace, type UnsavedSwitch } from "@/features/workspace";
import * as React from "react";

/**
 * 저장하지 못한 채 워크스페이스를 바꾸려 할 때 묻는다 (DATA-03).
 * 앱 닫기와 같은 선택지: 다시 시도 · 저장하지 않고 진행 · 취소. 막힌 채로 두지 않는다.
 */
export function UnsavedSwitchDialog() {
  const unsaved = useWorkspace((s) => s.unsaved);
  const [busy, setBusy] = React.useState(false);

  const choose = async (pick: (u: UnsavedSwitch) => Promise<void>) => {
    if (!unsaved || busy) return;
    setBusy(true);
    try {
      await pick(unsaved);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!unsaved}
      onOpenChange={(open) => {
        if (!open && !busy) unsaved?.cancel();
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>저장하지 못한 변경이 있어요</DialogTitle>
          <DialogDescription>
            지금 워크스페이스의 변경을 아직 저장하지 못했어요. 다시 시도하거나, 저장하지 않고
            워크스페이스를 바꿀 수 있어요. 저장하지 않고 바꾸면 마지막으로 저장된 내용만 남아요.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => unsaved?.cancel()}>
            취소
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void choose((u) => u.discard())}
          >
            저장하지 않고 진행
          </Button>
          <Button disabled={busy} onClick={() => void choose((u) => u.retry())}>
            다시 시도
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
