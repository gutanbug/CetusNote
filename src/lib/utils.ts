import { createCn } from "cn/config";

/**
 * 클래스 합치기 + Tailwind 충돌 정리.
 * 프로젝트 토큰 유틸리티(globals.css @theme)를 알려 줘야 `text-ui`(크기)와
 * `text-accent-on`(색)을 서로 다른 그룹으로 본다.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["micro", "label", "caption", "ui", "body", "code", "h3", "h2", "h1", "title"] },
      ],
      shadow: [{ shadow: ["popover", "modal", "knob"] }],
      rounded: [{ rounded: ["hair", "pill"] }],
    },
  },
});
