import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { createExtensions } from "./extensions";

/*
 * 계산 줄 + 한글 조합 (EDIT-38). 브라우저 입력기 경로(CDP Input.imeSetComposition → compositionstart/update/end)로
 * 한글을 조합하면서 결과 표시가 조합을 끊지 않는지 본다. 조합 중에는 결과 장식 DOM을 바꾸지 않고, 끝나면 다시 계산한다.
 */

type Ime = { imeCompose(text: string): Promise<void>; imeCommit(text: string): Promise<void> };
const ime = commands as unknown as Ime;

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

function mount(html: string) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({ element, extensions: createExtensions({}), content: html });
  editor.view.focus();
  return editor;
}

function caretAt(e: Editor, pos: number) {
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, pos)));
  e.view.focus();
}

const results = () =>
  [...document.querySelectorAll(".sn-calc-result")].map((el) => el.childNodes[1]?.textContent);
const tick = () => new Promise((r) => setTimeout(r, 30));

describe("계산 줄 한글 조합 (EDIT-38)", () => {
  it("결과 줄 앞의 이름표를 한글로 조합해도 글이 바르게 들어가고, 조합 중 결과 DOM은 그대로다", async () => {
    const e = mount("<p>12,000 + 4,500 =</p>");
    await tick();
    const before = document.querySelector(".sn-calc-result");
    expect(results()).toEqual(["16,500"]);
    caretAt(e, 1);
    // 「점심 」을 조합: ㅈ → 저 → 점 (확정) → ㅅ → 시 → 심 (확정) → 공백
    for (const step of ["ㅈ", "저", "점"]) await ime.imeCompose(step);
    // 조합 중에는 같은 DOM을 쓴다(바꾸면 WebKit 입력기가 끊긴다)
    expect(document.querySelector(".sn-calc-result")).toBe(before);
    await ime.imeCommit("점");
    for (const step of ["ㅅ", "시", "심"]) await ime.imeCompose(step);
    await ime.imeCommit("심");
    await ime.imeCommit(" ");
    await tick();
    expect(e.state.doc.textContent).toBe("점심 12,000 + 4,500 =");
    expect(results()).toEqual(["16,500"]);
  });

  it("= 뒤에 한글을 조합하면 조합이 끝난 뒤 결과가 사라진다(줄이 더는 = 로 끝나지 않는다)", async () => {
    const e = mount("<p>1 + 2 =</p>");
    await tick();
    expect(results()).toEqual(["3"]);
    caretAt(e, e.state.doc.content.size - 1);
    for (const step of ["ㅇ", "워", "원"]) await ime.imeCompose(step);
    await ime.imeCommit("원");
    await tick();
    expect(e.state.doc.textContent).toBe("1 + 2 =원");
    expect(results()).toEqual([]);
  });

  it("조합으로 = 를 지운 이름을 고치면 아래 줄 결과가 조합이 끝난 뒤 바뀐다", async () => {
    const e = mount("<p>값 = 10</p><p>값 * 2 =</p>");
    await tick();
    expect(results()).toEqual(["20"]);
    // 첫 줄 「값」 뒤에 「이」를 조합해 이름을 「값이」로 — 아래 줄은 더는 「값」을 모른다
    caretAt(e, 2);
    for (const step of ["ㅇ", "이"]) await ime.imeCompose(step);
    await ime.imeCommit("이");
    await tick();
    expect(e.state.doc.child(0).textContent).toBe("값이 = 10");
    expect(results()).toEqual([]);
  });
});
