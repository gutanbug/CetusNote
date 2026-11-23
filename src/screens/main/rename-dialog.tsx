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
            <DialogTitle>폴더 이름</DialogTitle>
            <DialogDescription>사이드바에 보이는 이름이에요.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label="폴더 이름"
            value={name}
            placeholder="이름 없는 폴더"
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
