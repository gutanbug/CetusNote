import { describe, expect, it } from "vitest";
import { assignAssetNames, pageAssetSrcs } from "./assets";
import type { MdNode } from "./markdown";

const ID = "01JD0000000000000000000000";

describe("단일 페이지 이미지 목록 (DATA-04)", () => {
  it("이미지와 첨부를 등장 순서대로, 같은 파일은 한 번만 모은다", () => {
    const doc: MdNode = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: `assets/${ID}/a.png` } },
        {
          type: "paragraph",
          content: [{ type: "attachment", attrs: { path: `assets/${ID}/b.pdf`, name: "b.pdf" } }],
        },
        { type: "image", attrs: { src: `assets/${ID}/a.png` } },
        { type: "image", attrs: { remote: "https://example.com/x.png" } },
      ],
    };
    expect(pageAssetSrcs(doc)).toEqual([`assets/${ID}/a.png`, `assets/${ID}/b.pdf`]);
  });

  it("같은 파일 이름은 ` (2)`로 구분하고, 금지 글자는 뺀다", () => {
    const srcs = [
      `assets/${ID}/a.png`,
      `assets/01JE0000000000000000000000/a.png`,
      `assets/${ID}/a:b?.png`,
    ];
    expect(assignAssetNames(srcs).map((a) => a.name)).toEqual(["a.png", "a (2).png", "a b.png"]);
  });

  it("긴 이름은 UTF-8 상한 안으로 자른다", () => {
    const long = `assets/${ID}/${"가".repeat(100)}.png`;
    const [a] = assignAssetNames([long]);
    expect(new TextEncoder().encode(a.name).length).toBeLessThanOrEqual(240);
    expect(a.name.endsWith(".png")).toBe(true);
  });
});
