/** GitHub 저장소 (업데이트 확인 endpoint와 같은 곳). 릴리스 페이지 링크는 여기서만 만든다 (SYS-12) */
export const RELEASE_REPO = "gutanbug/CetusNote";

/** 버전의 GitHub 릴리스 페이지. 「1.2.3」과 「v1.2.3」 모두 받는다 */
export function releaseUrl(version: string): string {
  const tag = version.replace(/^v/, "");
  return `https://github.com/${RELEASE_REPO}/releases/tag/v${tag}`;
}
