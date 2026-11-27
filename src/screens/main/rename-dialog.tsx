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
import * as React from "react";
import { useMessages } from "@/lib/i18n";

/** 폴더 이름 바꾸기 (SHELL-14). 문서는 페이지 머리의 제목에서 바로 고친다. 부르는 쪽이 대상마다 key를 바꿔 처음 값을 다시 잡는다 */
export function RenameDialog({
  open,
  initial,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initial: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}) {
  const m = useMessages();
  const [name, setName] = React.useState(initial);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(name.trim());
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{m.screens.dialogs.rename.title}</DialogTitle>
            <DialogDescription>{m.screens.dialogs.rename.description}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label={m.screens.dialogs.rename.label}
            value={name}
            placeholder={m.screens.dialogs.rename.placeholder}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {m.screens.dialogs.cancel}
            </Button>
            <Button type="submit">{m.screens.dialogs.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
