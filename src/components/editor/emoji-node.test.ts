import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TiptapEmoji from "@tiptap/extension-emoji";
import { Emoji } from "./emoji-node";

/** SYS-11: 우리 이모지 노드는 Tiptap 이모지 노드와 같은 스키마·JSON을 가진다 */
describe("Emoji node (SYS-11)", () => {
  const ours = getSchema([StarterKit, Emoji]);
  const theirs = getSchema([StarterKit, TiptapEmoji]);

  it("keeps the same node shape as the Tiptap extension", () => {
    const a = ours.nodes.emoji;
    const b = theirs.nodes.emoji;
    expect(a.isInline).toBe(b.isInline);
    expect(a.isLeaf).toBe(b.isLeaf);
    expect(a.spec.group).toBe(b.spec.group);
    expect(a.spec.selectable).toBe(b.spec.selectable);

    expect(Object.keys(a.spec.attrs ?? {})).toEqual(Object.keys(b.spec.attrs ?? {}));
  });

  it("round-trips a doc containing an emoji node saved by the old extension", () => {
    const saved = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "좋아 " },
            { type: "emoji", attrs: { name: "smile" } },
            { type: "text", text: " 끝" },
          ],
        },
      ],
    };
    const fromOld = theirs.nodeFromJSON(saved).toJSON();
    expect(fromOld).toEqual(saved);
    const fromOurs = ours.nodeFromJSON(saved).toJSON();
    expect(fromOurs).toEqual(saved);
  });
});
