import type { Editor } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export type MathEditTarget = { kind: "inline" | "block"; pos: number; latex: string } | null;

/**
 * ED-Math의 편집 팝오버 — 수식을 누르면 LaTeX를 고친다. 비우고 적용하면 수식을 지운다.
 * 닫으면 캐럿을 수식 바로 뒤에 두고 에디터로 돌아간다(수식이 선택된 채로 남아 다음 글자에 덮이지 않게).
 * 빈 수식(`/수식`으로 막 넣은 것)을 취소하면 지운다.
 */
export function MathPopover({
  editor,
  target,
  onClose,
}: {
  editor: Editor;
  target: MathEditTarget;
  onClose: () => void;
}) {
  const anchor = React.useMemo(
    () => ({
      getBoundingClientRect: () => {
        const dom = target ? (editor.view.nodeDOM(target.pos) as HTMLElement | null) : null;
        return dom?.getBoundingClientRect() ?? new DOMRect();
      },
    }),
    [editor, target],
  );

  /** latex: 적용할 값, null: 취소 */
  const finish = (latex: string | null) => {
    if (!target) return;
    const { kind, pos } = target;
    const remove = latex === "" || (latex === null && target.latex === "");
    let chain = editor.chain();
    if (remove)
      chain = kind === "inline" ? chain.deleteInlineMath({ pos }) : chain.deleteBlockMath({ pos });
    else if (latex !== null)
      chain =
        kind === "inline"
          ? chain.updateInlineMath({ latex, pos })
          : chain.updateBlockMath({ latex, pos });
    chain
      .command(({ tr }) => {
        const after = remove ? pos : pos + (tr.doc.nodeAt(pos)?.nodeSize ?? 0);
        const at = Math.min(after, tr.doc.content.size);
        tr.setSelection(Selection.near(tr.doc.resolve(at)));
        return true;
      })
      .focus()
      .run();
    onClose();
  };

  return (
    <Popover open={!!target} onOpenChange={(o) => !o && finish(null)}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent
        aria-label="수식 편집"
        side="bottom"
        className="w-90 p-2"
        // 기준이 가상 요소라 돌아갈 곳이 없다 — 포커스는 finish가 에디터로 돌린다
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {target ? (
          <MathForm
            key={`${target.pos}:${target.latex}`}
            initial={target.latex}
            onApply={finish}
            onCancel={() => finish(null)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function MathForm({
  initial,
  onApply,
  onCancel,
}: {
  initial: string;
  onApply: (latex: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initial);
  const inputId = React.useId();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(value.trim());
      }}
      className="grid gap-2"
    >
      <label htmlFor={inputId} className="text-label font-semibold text-secondary">
        LaTeX
      </label>
      <Input
        id={inputId}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="예: E = mc^2…"
        className="font-mono"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" size="sm">
          적용
        </Button>
      </div>
    </form>
  );
}
