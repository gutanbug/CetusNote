/**
 * 한국어 문구 묶음 (SYS-14). 이 객체의 모양이 모든 언어의 기준이다 — 다른 언어는 `Messages` 타입으로 같은 키를 채운다.
 * 영역마다 파일 하나: 키는 영역 안에서 화면·컴포넌트 이름으로 묶는다.
 */
import { common } from "./common";
import { ui } from "./ui";
import { shell } from "./shell";
import { editor } from "./editor";
import { collection } from "./collection";
import { page } from "./page";
import { settings } from "./settings";
import { screens } from "./screens";
import { features } from "./features";

export const ko = { common, ui, shell, editor, collection, page, settings, screens, features };

export type Messages = typeof ko;
