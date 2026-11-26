const encoder = new TextEncoder();

/** 글자(코드 포인트) 단위로 자르되, UTF-8로 `maxBytes` 바이트를 넘지 않게 한다. 한글은 한 글자 3바이트 */
export function capUtf8Bytes(text: string, maxBytes: number): string {
  let out = "";
  let used = 0;
  for (const ch of text) {
    const size = encoder.encode(ch).length;
    if (used + size > maxBytes) break;
    out += ch;
    used += size;
  }
  return out;
}
