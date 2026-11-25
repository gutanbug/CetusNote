/**
 * 영상의 첫 프레임을 미리 그리게 하는 미디어 조각 식별자.
 * `preload="metadata"`만으로는 WKWebView가 첫 프레임을 그리지 않고 회색 빈 화면으로 둔다.
 * `#t=0.001`은 재생 위치를 0.001초로 옮기라는 뜻이라 첫 프레임을 디코딩하고, 서버로는 가지 않는다.
 * 소리에는 쓰지 않는다. 이미 조각이 있는 주소는 그대로 둔다.
 */
export const FIRST_FRAME_FRAGMENT = "#t=0.001";

export function withFirstFrame(url: string): string {
  return url.includes("#") ? url : `${url}${FIRST_FRAME_FRAGMENT}`;
}
