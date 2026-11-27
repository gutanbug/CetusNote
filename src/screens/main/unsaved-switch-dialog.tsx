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
import { useMessages } from "@/lib/i18n";

/**
 * 저장하지 못한 채 워크스페이스를 바꾸려 할 때 묻는다 (DATA-03).
 * 앱 닫기와 같은 선택지: 다시 시도 · 저장하지 않고 진행 · 취소. 막힌 채로 두지 않는다.
 */
export function UnsavedSwitchDialog() {
  const unsaved = useWorkspace((s) => s.unsaved);
  const m = useMessages();
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
          <DialogTitle>{m.screens.dialogs.unsaved.title}</DialogTitle>
          <DialogDescription>{m.screens.dialogs.unsaved.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => unsaved?.cancel()}>
            {m.screens.dialogs.cancel}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void choose((u) => u.discard())}
          >
            {m.screens.dialogs.unsaved.discard}
          </Button>
          <Button disabled={busy} onClick={() => void choose((u) => u.retry())}>
            {m.screens.dialogs.unsaved.retry}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
