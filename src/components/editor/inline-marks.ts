import { Extension, markInputRule, type InputRule } from "@tiptap/core";

/**
 * EDIT-10 — 인라인 서식 단축 입력(`**굵게**` `*기울임*` `~~취소~~` `` `코드` `` `==강조==`)을
 * 앞 글자 경계 없이 받는다. StarterKit 기본 규칙은 `(?:^|\s)`를 요구해서 `가**나**다`처럼
 * 한글 바로 뒤에 붙은 서식이 적용되지 않았다. 닫는 표식 뒤의 조사(`**굵게**를`)는 원래 맞았다.
 * 우선순위를 높여 기본 규칙보다 먼저 본다. `_`(밑줄 기울임)은 단어 안에서 쓰지 않는 CommonMark 규칙을 따른다.
 */
export const InlineMarkShortcuts = Extension.create({
  name: "inlineMarkShortcuts",
  priority: 1000,
  addInputRules() {
    const { bold, italic, strike, code, highlight } = this.editor.schema.marks;
    const rules: InputRule[] = [];
    if (bold) rules.push(markInputRule({ find: /\*\*([^*]+)\*\*$/, type: bold }));
    if (italic)
      rules.push(markInputRule({ find: /(?<!\*)\*([^*\s](?:[^*]*[^*\s])?)\*$/, type: italic }));
    if (strike) rules.push(markInputRule({ find: /~~([^~]+)~~$/, type: strike }));
    if (code) rules.push(markInputRule({ find: /`([^`]+)`$/, type: code }));
    if (highlight) rules.push(markInputRule({ find: /==([^=]+)==$/, type: highlight }));
    return rules;
  },
});
