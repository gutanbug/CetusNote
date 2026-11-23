import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { workspaceErrorMessage, workspaceStore } from "@/features/workspace";
import * as React from "react";
import { useRestoreFocus } from "./use-restore-focus";

/**
 * 새 워크스페이스 (SHELL-15): 이름을 적고 "위치 고르기" → 시스템 폴더 대화상자 → <위치>/<이름> 폴더를 만들어 연다.
 * 오류(같은 이름 등)는 대화상자 안에 보여 이름을 바로 고칠 수 있게 한다.
 */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const errorId = React.useId();
  const trimmed = name.trim();
  // 워크스페이스 메뉴 항목에서 열면 닫을 때 그 버튼(스위처)으로 포커스를 돌린다
  useRestoreFocus(open);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (!o) {
          setName("");
          setError(null);
        }
      }}
    >
      <DialogContent size="sm">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!trimmed || busy) return;
            setBusy(true);
            setError(null);
            try {
              const made = await workspaceStore.getState().create(trimmed);
              if (made) {
                onOpenChange(false);
                setName("");
              }
            } catch (err) {
              setError(workspaceErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>새 워크스페이스</DialogTitle>
            <DialogDescription>
              이름으로 새 폴더를 만들어 노트를 따로 모아요. 다음 단계에서 폴더를 둘 위치를 골라요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Input
              autoFocus
              aria-label="워크스페이스 이름"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? errorId : undefined}
              value={name}
              maxLength={80}
              name="workspace-name"
              autoComplete="off"
              placeholder="예: 업무 노트…"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error ? (
              <p id={errorId} role="alert" className="text-label text-danger">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={!trimmed || busy}>
              위치 고르기…
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
