import type { JSONContent } from "@tiptap/core";

/**
 * 가져온 문서 안의 페이지 멘션을 새 페이지 id로 바꾼다 (DATA-11).
 * 변환 결과의 멘션 id는 항목 key(`p:<경로>`)다. 목록에 없는 대상(건너뛴 문서)은 글자만 남긴다.
 */
export function remapMentions(doc: JSONContent, ids: Map<string, string>): JSONContent {
  const walk = (node: JSONContent): JSONContent[] => {
    if (node.type === "pageMention") {
      const target = ids.get(String(node.attrs?.id ?? ""));
      if (target) return [{ ...node, attrs: { ...node.attrs, id: target } }];
      const label = String(node.attrs?.label ?? "");
      return label ? [{ type: "text", text: label }] : [];
    }
    if (!node.content) return [node];
    const content = node.content.flatMap(walk);
    return [{ ...node, content }];
  };
  const [out] = walk(doc);
  return out ?? doc;
}
