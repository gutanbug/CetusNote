import { InputRule } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";

/** ED-Toggle — 제목 + 접히는 내용. 열림 상태를 문서에 저장한다. `>>` + 스페이스로 만든다. */
const Toggle = Details.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /^>>\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).setDetails().run();
        },
      }),
    ];
  },
}).configure({
  persist: true,
  HTMLAttributes: { class: "sn-toggle" },
  renderToggleButton: ({ element, isOpen }) => {
    element.setAttribute("aria-label", "토글");
    element.setAttribute("aria-expanded", String(isOpen));
    element.className = "sn-toggle-button";
  },
});

export const toggleExtensions = [Toggle, DetailsSummary, DetailsContent];
