import type { Editor } from "@tiptap/core";
import * as React from "react";
import { CaretPopup } from "./caret-popup";
import type { SlashState } from "./slash-command";
import type { SlashItem } from "./slash-items";
import { SlashMenu, slashOptionId } from "./slash-menu";

type SlashLayerProps = {
  editor: Editor;
  state: SlashState | null;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  onSelect: (item: SlashItem) => void;
};

/** ED-SlashMenu를 캐럿 아래에 띄운다 */
export function SlashLayer({
  editor,
  state,
  activeIndex,
  onActiveChange,
  onSelect,
}: SlashLayerProps) {
  const listId = React.useId().replace(/:/g, "") + "-slash";
  if (!state) return null;
  const activeItem = state.items[activeIndex];
  return (
    <CaretPopup
      editor={editor}
      clientRect={state.clientRect}
      listId={listId}
      activeOptionId={activeItem ? slashOptionId(listId, activeItem) : undefined}
    >
      <SlashMenu
        id={listId}
        items={state.items}
        query={state.query}
        activeIndex={activeIndex}
        onActiveChange={onActiveChange}
        onSelect={onSelect}
      />
    </CaretPopup>
  );
}
