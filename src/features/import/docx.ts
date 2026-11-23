import mammoth from "mammoth";

/**
 * .docx → HTML (DATA-08). mammoth가 제목·목록·표·링크·서식을 HTML로 바꾸고,
 * 문서 안 그림은 data URL로 둔다(가져오는 쪽이 페이지 assets로 옮긴다).
 * 글 스타일이 없는 문서도 글자는 모두 나온다. 변환 경고는 무시한다.
 */
export async function docxToHtml(bytes: Uint8Array): Promise<string> {
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.read("base64")}`,
      })),
    },
  );
  return result.value;
}
