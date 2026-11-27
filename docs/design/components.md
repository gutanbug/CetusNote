# UI 컴포넌트 목록 (Component Inventory)

모든 UI 컴포넌트를 계층별로 정리한 목록이다. **이 목록에 없는 컴포넌트는 만들지 않는다.** 필요하면 먼저 여기에 추가한다.

- **ID 규칙:** `계층접두어-이름` (예: `UI-Button`). 코드의 Debug 레지스트리, 스토리 제목, 커밋 메시지에서 같은 ID를 쓴다.
- **출처:** `shadcn` = shadcn/ui로 생성 후 토큰에 맞게 수정 · `tiptap` = Tiptap 확장/노드 뷰 · `커스텀` = 직접 작성
- **시트:** OpenDesign `components.html`의 섹션 번호. 구현 전에 그 섹션을 열어 비교한다.
- **상태 표기:** 모든 컴포넌트는 해당하는 상태를 Debug 화면에서 보여야 한다.
  `D` default · `H` hover · `A` active/selected · `F` focus-visible · `X` disabled · 그 밖의 상태는 따로 적는다.
- **진행 상태:** `계획` → `구현` → `Ready`(Debug 화면에 등록, 라이트/다크 확인) → `감사 완료`(UI 감사 통과)

## 계층 구조

```
L0 Tokens          tokens.css (docs/design/tokens.md)
L1 UI 기본 요소     components/ui/        버튼, 입력, 칩, 배지 …
L2 오버레이         components/ui/        팝오버, 메뉴, 모달, 팔레트, 토스트
L3 셸              components/shell/     사이드바, 상단 바, 탭
L4 에디터           components/editor/    Tiptap 블록, 슬래시 메뉴, 툴바
L5 페이지 부품       components/page/      페이지 헤더, 속성, 템플릿, 설정 부품
L6 컬렉션           components/collection/ 표/보드/캘린더 (P2)
```

위 계층은 아래 계층만 import한다(L3 → L1·L2 가능, L1 → L3 불가).

---

## L0 — 토큰 (Debug 화면 "Tokens" 섹션)

| ID       | 내용                                           | 시트   |
| -------- | ---------------------------------------------- | ------ |
| TK-Color | 기본 색상, 소프트 컬러 9종, 포인트 색 8종 견본 | §18–20 |
| TK-Type  | 타이포 스케일 견본                             | §21    |
| TK-Space | 간격, 반경, 그림자, 모션 견본                  | §22    |
| TK-Icon  | 사용하는 lucide 아이콘 목록(16/20px)           | §23    |

## L1 — UI 기본 요소

| ID               | 컴포넌트                | 변형                                                                                                          | 상태                                                                                                                                                                                                                                   | 출처                                                                   | 시트 | 우선 | 진행      |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---- | ---- | --------- |
| UI-Button        | 버튼                    | primary · secondary · ghost · danger / size sm·md                                                             | D H A F X, loading                                                                                                                                                                                                                     | shadcn `button`                                                        | §2   | P0   | 감사 완료 |
| UI-IconButton    | 아이콘 버튼             | ghost / sm·md, 툴팁 포함                                                                                      | D H A F X                                                                                                                                                                                                                              | shadcn `button`                                                        | §2   | P0   | 감사 완료 |
| UI-Input         | 입력창                  | 기본 · 오류                                                                                                   | D H F X, error                                                                                                                                                                                                                         | shadcn `input`                                                         | §3   | P0   | 감사 완료 |
| UI-SearchInput   | 검색창                  | 아이콘 + 지우기 버튼                                                                                          | D F, 값 있음                                                                                                                                                                                                                           | 커스텀(UI-Input 확장)                                                  | §3   | P0   | 감사 완료 |
| UI-Switch        | 토글 스위치             | —                                                                                                             | on/off, F X                                                                                                                                                                                                                            | shadcn `switch`                                                        | §3   | P0   | Ready     |
| UI-Checkbox      | 체크박스                | —                                                                                                             | on/off/indeterminate, F X                                                                                                                                                                                                              | shadcn `checkbox`                                                      | §3   | P0   | 감사 완료 |
| UI-Kbd           | 단축키 배지             | 단일 키 · 조합(`⌘` `K`)                                                                                       | —                                                                                                                                                                                                                                      | 커스텀                                                                 | §6   | P0   | 감사 완료 |
| UI-TagChip       | 태그 칩                 | 소프트 컬러 9종 · 삭제 버튼 유무                                                                              | D H                                                                                                                                                                                                                                    | 커스텀                                                                 | §4   | P0   | 감사 완료 |
| UI-StatusChip    | 상태 칩                 | 할 일 · 진행 중 · 검토 · 완료                                                                                 | —                                                                                                                                                                                                                                      | 커스텀                                                                 | §11  | P0   | 감사 완료 |
| UI-Avatar        | 이니셜 아바타           | sm·md                                                                                                         | —                                                                                                                                                                                                                                      | shadcn `avatar`                                                        | §1   | P0   | 감사 완료 |
| UI-Separator     | 구분선                  | 가로·세로                                                                                                     | —                                                                                                                                                                                                                                      | shadcn `separator`                                                     | —    | P0   | 감사 완료 |
| UI-Tooltip       | 툴팁                    | 텍스트 · 텍스트+단축키                                                                                        | 열림                                                                                                                                                                                                                                   | shadcn `tooltip`                                                       | §6   | P0   | 감사 완료 |
| UI-ScrollArea    | 스크롤 영역             | —                                                                                                             | 스크롤 시 상단 구분선                                                                                                                                                                                                                  | shadcn `scroll-area`                                                   | —    | P0   | 감사 완료 |
| UI-Segmented     | 세그먼트 컨트롤         | 2–4개                                                                                                         | 선택                                                                                                                                                                                                                                   | shadcn `toggle-group`                                                  | —    | P1   | 감사 완료 |
| UI-Progress      | 진행률 바               | —                                                                                                             | 0/50/100%                                                                                                                                                                                                                              | shadcn `progress`                                                      | §15  | P2   | 감사 완료 |
| UI-Constellation | 고래자리(브랜드 모티프) | 크기 sm(로고)·md(홈·페이지·템플릿·빈 화면, 화면은 SkyMark로 감싸 씀)·lg(쓰지 않음, 옛 페이지 배경용), 별 이름 | strong/faint, 별마다 반짝임·옅은 빛·밝은 별 십자 빛줄기(md·strong만, 움직임 줄이기 시 정지). glow soft(기본)·radiant(스플래시·첫 설정·홈·페이지·빈 화면: 방사형 번짐·흰 심·끝이 사라지는 빛줄기·잔별, 블러 없음·별마다 애니메이션 1개) | 커스텀(SVG)                                                            | §25  | P1   | Ready     |
| UI-PageIcon      | 페이지 아이콘           | 이모지 · lucide 아이콘(색 9종) · 올린 이미지 — 글자 크기(1em)에 맞춰 그린다                                   | 이미지 불러오는 중                                                                                                                                                                                                                     | 커스텀                                                                 | —    | P1   | Ready     |
| UI-AppLogo       | 다른 앱 로고            | notion · obsidian · appflowy · affine, 단색(currentColor), 24px 기본                                          | 글자색을 따른다                                                                                                                                                                                                                        | 커스텀(SVG, 예외 아래)                                                 | —    | P1   | Ready     |
| UI-ChoiceCard    | 선택 카드(라디오 그룹)  | 2·3·4열, 그림 · 제목 · 한 줄 설명                                                                             | D H A(선택, 체크 표시) F                                                                                                                                                                                                               | Radix `radio-group`                                                    | —    | P1   | Ready     |
| UI-Calendar      | 달력(월 격자)           | 월 7열(일요일 시작), 오늘 포인트 테두리, 선택 날짜, 이전·다음 달 버튼, 다른 달 날짜 흐리게                    | D H A F X, 오늘 · 선택                                                                                                                                                                                                                 | 커스텀(CL-CalendarView 격자와 시각 맞춤, L6 import 불가라 따로 만든다) | —    | P2   | Ready     |

- **UI-Switch 메모:** 누름 영역을 36×24로 넓힌 뒤(473ce9f) 스토리와 레지스트리만 다시 확인했다. 라이트/다크 시트 비교와 UI 감사는 아직 다시 하지 않았다. 감사 완료로 되돌리기 전에 해야 한다.

### UI-AppLogo 예외 메모 (2026-11-23)

- **예외:** L1 아이콘은 lucide만 쓴다는 규칙(frontend 규칙)의 예외다. 사용자가 「각 플랫폼별 아이콘」을 요청했다(2026-11-23). 다른 앱의 상표이므로 어느 앱인지 알리는 용도로만 쓴다.
- **원천과 라이선스(파일 머리 주석에도 적음):** Notion · Obsidian · AFFiNE = Simple Icons 16.38.1, CC0-1.0. AppFlowy = `AppFlowy-IO/AppFlowy`의 `frontend/appflowy_flutter/assets/images/flowy_logo.svg`, 저장소 라이선스 AGPL-3.0(마크 상표는 AppFlowy에 있음). 색은 모두 `currentColor`로 바꿨고 AppFlowy 마크는 겹친 조각이 한 덩어리로 보인다.
- **네트워크:** 실행 중 가져오지 않는다. `components/ui/app-logo.tsx`에 번들한다.

### UI-ChoiceCard 메모 (2026-11-23)

- **키보드(요청 사양):** 화살표 키는 포커스만 옮기고, Enter·Space가 고른다. Radix 라디오는 화살표로 고르고 Enter를 막으므로, Enter는 카드에서 직접 처리한다. 선택된 카드에 체크 표시(Radix Indicator)가 붙는다.
- **Debug 확인:** 라이트·다크 시트, 화살표·Enter·Space를 Aside 미리보기 Debug 화면에서 확인했다.

## L2 — 오버레이

| ID                | 컴포넌트               | 내용                                                                                                                                                                                              | 상태                       | 출처                                                     | 시트                  | 우선 | 진행      |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------- | --------------------- | ---- | --------- |
| OV-Popover        | 팝오버 기본 틀         | 그림자, 반경, 등장 모션                                                                                                                                                                           | 열림                       | shadcn `popover`                                         | §5                    | P0   | 감사 완료 |
| OV-Menu           | 메뉴 / 컨텍스트 메뉴   | 항목(아이콘·라벨·단축키·하위 메뉴 화살표), 구분선, 그룹 라벨, danger 항목, 체크 항목(아이콘이 있으면 체크는 오른쪽 끝)                                                                            | 항목 D H F X               | shadcn `dropdown-menu` · `context-menu`                  | §5                    | P0   | 감사 완료 |
| OV-Dialog         | 모달                   | 크기 sm·md·lg, scrim. 머리글: `DialogHeader`(제목·설명 묶음, 오른쪽 pr-8) · `DialogHeaderRow`(제목과 동작이 한 줄, 오른쪽 pr-14로 × 자리 비움). 헤더 줄에 직접 flex를 짜지 않는다                 | 열림                       | shadcn `dialog`                                          | —                     | P0   | 감사 완료 |
| OV-CommandPalette | 명령 팔레트(⌘K)        | 입력, 그룹(최근/결과/명령), 결과 행(하이라이트·스니펫·경로), 하단 키 안내, 빈 결과                                                                                                                | 선택 행                    | shadcn `command`(cmdk)                                   | index.html `.palette` | P0   | 감사 완료 |
| OV-Toast          | 토스트                 | 메시지 · 메시지+실행 취소 · 오류 · 유지형(주 버튼 + 닫기 보조 버튼 · 아이콘 전용 ✕ `ToastCloseButton`, aria-label·title 「닫기」)                                                                 | —                          | shadcn `sonner`                                          | §6                    | P0   | 감사 완료 |
| OV-ColorPopover   | 글자색/하이라이트 선택 | 소프트 컬러 9종 2줄                                                                                                                                                                               | 선택                       | 커스텀                                                   | —                     | P0   | 감사 완료 |
| OV-LinkPopover    | 링크 입력/편집         | URL 입력, 열기, 제거                                                                                                                                                                              | —                          | 커스텀                                                   | —                     | P0   | 감사 완료 |
| OV-EmojiPicker    | 이모지 선택            | 검색, 최근, 카테고리, 제거(선택)                                                                                                                                                                  | 불러오는 중, 결과 없음     | frimousse(헤드리스) + 커스텀, 데이터는 앱에 번들(한국어) | —                     | P0   | 감사 완료 |
| OV-IconPicker     | 아이콘 고르기          | 탭 이모지(OV-EmojiPicker + 피부색·무작위)·아이콘(lucide 모음, 검색·카테고리·색·무작위)·업로드(끌어 놓기·파일 고르기·이미지 붙여넣기·최근), 제거                                                   | 결과 없음, 올리는 중, 오류 | 커스텀                                                   | —                     | P1   | Ready     |
| OV-Outline        | 목차                   | 상단 바 목차 버튼(⌥⌘O)의 메뉴 내용. "목차" 라벨 + 제목(H1–H3) 항목, 수준만큼 들여쓰기(가장 높은 수준이 왼쪽 끝), 지금 보는 제목은 포인트 색·aria-current. 열면 지금 제목에 포커스. 제목 없음 안내 | 기본 · 지금 없음 · 빈      | 커스텀 (OV-Menu 안에 넣음)                               | —                     | P2   | 감사 완료 |

### L1–L2 감사 메모 (2026-11-19)

프로토타입과 다르게 둔 부분과 감사에서 정한 예외다. 바꾸려면 여기부터 고친다.

- **프로토타입에 없는 hover를 더함:** UI-Input 테두리, UI-Checkbox, UI-ScrollArea 손잡이, UI-Switch(밝기 94%, 버튼과 같음). 누를 수 있는 것은 모두 포인터에 반응하게 한다.
- **포커스 링 대신 다른 표시:** OV-Menu 항목과 OV-CommandPalette 결과 행은 강조 배경으로 표시한다(메뉴 패턴, 실제 포커스는 목록에 있음). OV-CommandPalette 입력은 하나뿐이고 열리면 늘 포커스라 캐럿만 둔다(프로토타입과 같음).
- **UI-TagChip 삭제 버튼:** 칩에 마우스를 올리거나 키보드로 오면 드러난다. 자리는 늘 차지해 칩 폭이 바뀌지 않는다.
- **OV-CommandPalette 결과 행:** 간격·안쪽 여백·제목 굵기는 프로토타입 `.result`와 같다. 스니펫 글자는 12px(`text-label`)로 둔다. 프로토타입의 12.5px는 타이포 스케일에 없는 값이다.
- **OV-Toast:** 오류 아이콘은 `--inverse-danger`, 실행 취소 hover는 반전 글자 8%(다크 대비 4.67:1).
- **UI-Segmented:** 아이콘만 있는 옵션은 `ariaLabel`을 준다. **UI-Progress:** `aria-label` 또는 `aria-labelledby`가 타입에서 필수다. **OV-EmojiPicker:** 최근 목록은 `{ emoji, label }`로 받아 이름을 읽어 준다.

## L3 — 셸

| ID                   | 컴포넌트            | 내용                                                                                                                                                                                                                                                                                                      | 상태                                   | 출처                | 시트 | 우선 | 진행      |
| -------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------- | ---- | ---- | --------- |
| SH-Sidebar           | 사이드바 틀         | 섹션 배치, 접힘. macOS 앱은 맨 위에 신호등 자리(titleBarInset)                                                                                                                                                                                                                                            | 펼침/접힘                              | 커스텀              | —    | P0   | 감사 완료 |
| SH-Resizer           | 사이드바 리사이저   | 드래그 핸들                                                                                                                                                                                                                                                                                               | D H 드래그 중                          | 커스텀              | —    | P0   | 감사 완료 |
| SH-WorkspaceSwitcher | 워크스페이스 스위처 | 아바타 + 이름 + 펼침. 메뉴는 AppFlowy식 워크스페이스 목록(이니셜 타일 · 이름 · 페이지 수·위치 · 지금 것 체크) + 새 워크스페이스 · 다른 폴더 열기 타일 행 (SHELL-15). 지금 것이 아닌 행은 가리키거나 고르면 ×, Delete로 목록에서 빼기(SHELL-16 · 항목 안에 버튼을 겹치지 않는다). 목록이 없으면 맨 위 카드 | D H 열림                               | 커스텀              | §1   | P0   | 감사 완료 |
| SH-SidebarSection    | 사이드바 섹션       | 작은 라벨 제목, hover 시 접기/추가 버튼(추가 버튼은 바로 실행 또는 메뉴)                                                                                                                                                                                                                                  | 펼침/접힘                              | 커스텀              | §1   | P0   | 감사 완료 |
| SH-SidebarItem       | 사이드바 항목       | 펼침 화살표 + 아이콘 + 제목 + hover 액션(`···` `＋`) + 단축키 힌트                                                                                                                                                                                                                                        | D H **선택** 하위 펼침 **드래그 중** F | 커스텀              | §1   | P0   | 감사 완료 |
| SH-DropIndicator     | 드롭 가이드 라인    | 위/아래/안쪽                                                                                                                                                                                                                                                                                              | —                                      | 커스텀              | §1   | P1   | Ready     |
| SH-PageTree          | 페이지 트리         | 중첩 렌더, 키보드 탐색, 폴더 행(SHELL-14: 이름 누르면 펼침/접기)                                                                                                                                                                                                                                          | —                                      | 커스텀              | —    | P0   | 감사 완료 |
| SH-TagItem           | 태그 항목           | 색 점 + 이름 + 개수                                                                                                                                                                                                                                                                                       | D H A                                  | 커스텀              | —    | P1   | Ready     |
| SH-SaveStatus        | 저장 상태           | 저장됨 · 저장 중 · 오류                                                                                                                                                                                                                                                                                   | 3종                                    | 커스텀              | —    | P0   | 감사 완료 |
| SH-SidebarFooter     | 사이드바 하단       | 휴지통 + 저장 상태                                                                                                                                                                                                                                                                                        | —                                      | 커스텀              | —    | P0   | 감사 완료 |
| SH-TopBar            | 상단 바             | 사이드바 토글, 브레드크럼, 편집 시각, 액션. 창 끌기·신호등 자리(titleBar). 오른쪽 패널(분할 화면) 머리 변형은 2026-11-24 기능 제거로 삭제                                                                                                                                                                 | 스크롤됨(구분선)                       | 커스텀              | —    | P0   | 감사 완료 |
| SH-Breadcrumb        | 브레드크럼          | 경로, 긴 경로 생략(…)                                                                                                                                                                                                                                                                                     | D H                                    | shadcn `breadcrumb` | —    | P0   | 감사 완료 |
| SH-PageTabs          | 페이지 탭           | 탭(아이콘·제목·닫기), 새 탭                                                                                                                                                                                                                                                                               | D H 활성                               | 커스텀              | §9   | P1   | Ready     |

### L3 메모 (2026-11-19)

- 파일: `src/components/shell/`. 스토리 견본 데이터는 `src/debug/shell-data.ts`, 조립 예는 `shell-sample.tsx`(화면은 쓰지 않는다).
- **SH-SidebarItem:** 프로토타입 `.nav-item`(높이 30, 패딩 4·8, 14px). 단축키 힌트는 프로토타입의 글자 대신 `UI-Kbd`로 보인다(프론트엔드 규칙). 트리 행 모양은 SH-PageTree가 같은 조각(`shell/parts.ts`)으로 그린다.
- **PG-Backlinks(2026-11-20):** 프로토타입에 화면이 없어(메모에 "사이드 패널" 한 줄) 앱에 맞게 본문 아래 접이식 목록으로 그렸다. 머리(접기·페이지 수) + 페이지 행(아이콘·제목·언급 수) + 문맥 줄(언급 자리 `font-medium text-primary`). SH-SpaceHeader는 공간이 범위 밖이 되어 뺐다.
- **SH-PageTree:** WAI-ARIA tree(평평한 `aria-level`). 트리 안에서 Tab에 걸리는 행은 하나, ↑↓ ← → Home End Enter·Space, Shift+F10(또는 메뉴 키)로 행 메뉴. ··· ＋ 버튼은 마우스용(`tabIndex=-1`), 같은 일은 행 메뉴에 있다. 끌어서 옮기기(SHELL-06, 2026-11-19): `onDrop`·`canDrop`을 주면 행을 끌 수 있다. 놓을 자리는 놓는 순간의 포인터 높이로 정하고(표시가 늦어도 어긋나지 않게), 표시는 SH-DropIndicator. `draggingId`·`dropTarget`은 상태 고정용. 가상화(SYS-10, ADR-021): 펼쳐진 행만 평평한 목록으로 펴서 보이는 구간과 포커스·끄는 행만 그린다(`page-tree-rows.ts`: `flattenRows`·`windowRange`, 행 높이 30px 고정). 스크롤은 가장 가까운 ScrollArea 뷰포트를 따른다. 구간 밖이어도 포커스 행과 Tab 행은 남긴다. 끄는 중 가장자리(32px)에서는 자동 스크롤. 펼치기·접기 높이 애니메이션은 가상화와 함께 뺐다. 형제 수는 `aria-setsize`·`aria-posinset`으로 준다. 이름 바꾸기는 행 안 입력이 아니라 이름 바꾸기 다이얼로그(RenameDialog)다.
- **SH-Resizer:** 200–400px, ←→ 16px, Home/End, 두 번 누르면 240. 끄는 동안은 너비 전환 애니메이션을 끈다.
- **SH-Sidebar:** 접으면 너비 0 + `inert`. Radix 스크롤 영역의 안쪽 표가 긴 제목만큼 늘어나지 않게 `display: block`으로 고정했다.
- **SH-Breadcrumb:** shadcn breadcrumb와 같은 `nav > ol > li` 구조를 직접 썼다(설치하면 L1 파일이 하나 더 생겨서). 4단계를 넘으면 첫 항목 + “…” 메뉴 + 마지막 2개.
- **SH-TopBar:** 댓글 버튼은 범위 밖이라 뺐다. 버튼은 콜백을 준 것만 보인다.

### SH-TopBar 패널 머리 감사 메모 (2026-11-22, SHELL-19 · 기능 제거됨 2026-11-24)

과거 기록이다. 분할 화면 기능이 제거되어 지금 코드에는 패널 머리(`variant="pane"`)와 `dimmed` prop이 없다.

SH-SplitHeader는 SH-TopBar `variant="pane"`에 합쳤다(머리 두 줄 → 한 줄, 같은 44px). UI 감사 결과: 높음 0 · 중간 3 · 낮음 7. 고친 것: 제목 버튼 접근성 이름(`aria-label`에 "주 화면에서 열기"), 숨김 표시 아이콘을 상태 아이콘 `PanelRightDashed`로 바꿔 "패널 닫기"와 구분, "왼쪽과 바꾸기" → "주 화면과 바꾸기"(사이드바와 혼동), 숨김 표시 이름을 "오른쪽 패널 숨김됨 · 창을 넓히면 다시 보여요"로 통일.

- **중간(해결, SHELL-19 후속):** 활성 쪽 표시가 없었다. 패널이 열렸을 때 비활성 쪽 머리(제목·경로·아이콘)를 `text-tertiary`로 낮췄다(`dimmed` prop, 색만 바꾸고 자리·테두리·포커스는 그대로). 대비(2026-11-24 값 기준): 라이트 `--text-tertiary` #5F6675 on #FFFFFF 5.76:1, hover #F1F3F5 위 5.18:1, 다크 `#B4B9C0` on 바탕 8.63:1 / hover 6.71:1 — 전부 AA 통과라 제목도 tertiary로 두었다(text-secondary 대체 불필요). hover·focus 강제 variant는 IconButton 쪽 그대로. 활성 여부는 `useInactiveSide(side)`(split.ts)가 쥔다.
- **낮음(해결):** 구분선(SH-Resizer)을 패널 DOM 맨 앞으로 옮겼다. Tab 순서는 주 화면 → 구분선 → 패널 머리 → 편집기. 히트 폭 `w-1.25`는 기존 리사이저 규격. 포커스 링은 `focusRing`(accent) 그대로이고 브라우저 확인은 computed style만 했다(스크린샷 없음).
- **숨김 표시 검증:** 1024px에서 패널 표시, 640px에서 숨김 표시 노출, 누르면 토스트, 다시 넓히면 패널 복귀. 표시는 상태라 누르면 상태를 바꾸지 않는다(설명 토스트만).
- **OpenDesign·Storybook 비교 생략.**

### L3 감사 메모 (2026-11-19)

감사 결과 높음 0 · 중간 4 · 낮음 18. 중간 4건은 모두 고쳤다(페이지 메뉴 툴팁, 저장 오류는 `role="alert"`, 리사이저 Enter = 기본 너비 + `aria-valuetext`, 토글 버튼 이름 고정 "사이드바"·"즐겨찾기" + 상태는 `aria-expanded`·`aria-pressed`).

- **14px 아이콘(예외, 사용자 결정 2026-11-22):** 섹션 접기 화살표, 트리 펼침 화살표, 스위처 펼침, 트리 행 ··· ＋, 태그 행(SH-TagItem), 탭 바(SH-PageTabs)의 아이콘은 프로토타입대로 14px(`size-3.5`)다. 컬렉션 속성 칩(표 머리·속성 목록의 속성 아이콘)과 컬렉션 툴바 칩(필터 칩 등)도 같은 예외다(사용자 결정 2026-11-22, 크기 변경 없음). 30px 이하의 조밀한 목록 행 안의 보조 아이콘이라 16px 규칙의 예외로 둔다. 다른 아이콘 크기는 바꾸지 않는다.
- **트리 ··· 버튼 툴팁 없음(예외):** 마우스 전용(`tabIndex=-1`)이고 누르면 바로 메뉴가 열려 툴팁이 가린다. ＋는 툴팁이 있다.
- **말줄임:** 사이드바 항목·트리 제목·경로·워크스페이스 이름은 `title`로 전체 이름을 보인다.
- **남은 낮음(나중에):** ~~트리 타입어헤드~~(2026-11-21 구현: 제목 앞 글자·한글 초성, 같은 글자 반복은 다음 행), ~~`aria-setsize`·`aria-posinset`~~(2026-11-21: 트리 구조가 평평해 직접 준다. 스크린 리더 실측은 사용자 확인), 행 눌림 피드백(프로토타입에 없음), 하단 "포인트 색상" 항목 위치(설정 SET-03과 함께 정함), 화면 조립 때 상단 바 `header` 랜드마크가 한 번만인지 확인.

## L4 — 에디터 (Tiptap)

| ID                 | 컴포넌트             | 내용                                                                                                                                                  | 상태                             | 출처                                                          | 시트 | 우선 | 진행      |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------- | ---- | ---- | --------- |
| ED-Paragraph       | 텍스트               | —                                                                                                                                                     | —                                | tiptap StarterKit                                             | §7   | P0   | 감사 완료 |
| ED-Heading         | 제목 H1–H3           | —                                                                                                                                                     | —                                | tiptap StarterKit                                             | §7   | P0   | 감사 완료 |
| ED-List            | 글머리/번호 목록     | 중첩                                                                                                                                                  | —                                | tiptap StarterKit                                             | §7   | P0   | 감사 완료 |
| ED-TaskItem        | 체크리스트           | —                                                                                                                                                     | 완료(취소선+회색)                | tiptap `TaskList/TaskItem`                                    | §7   | P0   | 감사 완료 |
| ED-Toggle          | 토글 블록            | 제목 + 접히는 내용                                                                                                                                    | 열림/닫힘                        | tiptap 커스텀 노드                                            | §7   | P0   | 감사 완료 |
| ED-Quote           | 인용                 | —                                                                                                                                                     | —                                | tiptap StarterKit                                             | §7   | P0   | 감사 완료 |
| ED-Callout         | 콜아웃               | 이모지 + 소프트 컬러 9종 배경                                                                                                                         | —                                | tiptap 커스텀 노드                                            | §7   | P0   | 감사 완료 |
| ED-Divider         | 구분선               | —                                                                                                                                                     | 선택                             | tiptap StarterKit                                             | §7   | P0   | 감사 완료 |
| ED-CodeBlock       | 코드 블록            | 언어 선택(기본 자동 감지), 하이라이트, 복사                                                                                                           | 복사됨                           | tiptap `CodeBlockLowlight` + 노드 뷰                          | §7   | P0   | 감사 완료 |
| ED-InlineMarks     | 인라인 서식          | 굵게·기울임·밑줄·취소선·코드·링크·글자색·하이라이트·위/아래 첨자                                                                                      | —                                | tiptap marks                                                  | §7   | P0   | 감사 완료 |
| ED-Placeholder     | 플레이스홀더         | 빈 줄, 빈 제목                                                                                                                                        | —                                | tiptap `Placeholder`                                          | —    | P0   | 감사 완료 |
| ED-BlockHandle     | 블록 핸들            | `⋮⋮` 드래그, `＋` 추가, ⌘/ 블록 메뉴(키보드)                                                                                                          | D H 드래그 중                    | tiptap `DragHandle`                                           | —    | P0   | 감사 완료 |
| ED-SlashMenu       | 슬래시 메뉴          | 카테고리(기본 블록·미디어·고급), 항목(아이콘·이름·설명·단축 입력), 결과 없음                                                                          | 키보드 선택                      | tiptap `Suggestion` + OV-Popover                              | §5   | P0   | 감사 완료 |
| ED-FloatingToolbar | 플로팅 툴바          | 블록 변환 드롭다운, B I U S 코드 링크 색상                                                                                                            | 서식 켜짐                        | tiptap `BubbleMenu`                                           | —    | P0   | 감사 완료 |
| ED-PageMention     | 페이지 멘션          | `@` 제안 목록, 멘션 칩, 깨진 링크                                                                                                                     | —                                | tiptap `Mention`                                              | §7   | P1   | 감사 완료 |
| ED-Image           | 이미지               | 캡션(가운데), 양쪽 손잡이로 크기 조절(10~100%), 로딩/오류                                                                                             | —                                | 커스텀 노드(캡션 = 노드 글) + 노드 뷰                         | —    | P1   | Ready     |
| ED-Table           | 표                   | 행/열 추가                                                                                                                                            | 셀 선택                          | tiptap `Table`                                                | —    | P1   | 감사 완료 |
| ED-Editor          | 에디터 본체          | 확장 묶음, 본문 타이포·간격, 접근성 이름, 읽기 전용                                                                                                   | 편집/읽기 전용                   | tiptap `useEditor` + 커스텀 CSS                               | §7   | P0   | 감사 완료 |
| ED-Math            | 수식                 | 인라인 · 블록(KaTeX), 클릭해 LaTeX 편집 팝오버                                                                                                        | 오류(잘못된 식)                  | tiptap `Mathematics`                                          | —    | P1   | 감사 완료 |
| ED-TableMenu       | 표 편집 바           | 행·열 추가/삭제, 머리글 전환, 셀 병합/분리, 표 삭제                                                                                                   | 표 안에 커서                     | tiptap `BubbleMenu` + UI-IconButton                           | —    | P1   | 감사 완료 |
| ED-TabIndent       | Tab 들여쓰기         | 문단·제목·인용·콜아웃·토글 제목에 탭 문자, ⇧Tab 내어쓰기, 여러 줄, Esc 다음 Tab은 나가기                                                              | —                                | tiptap 커스텀 확장                                            | —    | P1   | Ready     |
| ED-MarkdownPaste   | 마크다운 붙여넣기    | 마크다운 글 → 제목·목록(중첩)·할 일·인용·코드(언어)·표·구분선·서식. 평범한 글·⇧⌘V·코드 블록 안은 글자 그대로, 코드 편집기 HTML 껍데기도 마크다운으로  | —                                | tiptap 커스텀 확장 + marked                                   | —    | P1   | Ready     |
| ED-FindBar         | 찾기 막대            | 찾기 칸·결과 수·이전/다음/닫기, ⌥⌘F 바꾸기 칸(바꾸기·모두 바꾸기). 결과는 주황, 지금 결과는 포인트 색 채움. 읽기 전용이면 찾기만                      | —                                | tiptap 커스텀 확장 + 커스텀                                   | —    | P1   | 감사 완료 |
| ED-CopyAsText      | 마크다운으로 복사    | 여러 블록 복사 때 text/plain을 위 계층 변환(features/export 마크다운)으로. 한 블록 안 일부·변환 없음은 기본 글자. 화면 요소 없음                      | —                                | tiptap 커스텀 확장                                            | —    | P1   | Ready     |
| ED-ToggleHeading   | 토글 제목            | H1–H3 제목 줄이 접힌다. 접힌 동안 아래 블록 숨김 · 펼침 상태는 문서에 저장                                                                            | 열림/닫힘, 펼침 단추 D H F       | 커스텀 노드 + 노드 뷰 (`toggleHeading > heading + 블록*`)     | —    | P2   | Ready     |
| ED-SubpageBlock    | 하위 페이지 링크     | 한 줄 행(카드 아님): 아이콘 · 제목 · 「하위 페이지」(hover) · 삭제된 페이지(흐림, 블록 지우기) · 휴지통 페이지 · 불러오는 중                          | D H F A(선택) 삭제됨 휴지통 로딩 | 커스텀 노드 + 노드 뷰                                         | —    | P1   | Ready     |
| ED-Breadcrumb      | 경로 표시 블록       | SH-Breadcrumb 재사용: 상위 항목, 긴 경로 생략(…)·숨긴 항목 메뉴, 현재 페이지는 마지막 항목(최상위면 이름 하나), 경로 없음·로딩                        | D H F A(선택) 로딩 없음          | 커스텀(SH-Breadcrumb 재사용, L4라서 import 가능)              | —    | P2   | Ready     |
| ED-FileAttachment  | 파일 첨부 카드       | 확장자별 lucide 아이콘 · 이름(말줄임) · 크기 · 형식, 올리는 중 · 크기 초과 오류 · 원본 없음                                                           | D H F A X, 올리는 중, 오류       | 커스텀 노드 + 노드 뷰                                         | —    | P1   | Ready     |
| ED-PdfViewer       | PDF 블록             | 쪽 스크롤 미리 보기, 확대·축소(UI-IconButton), 쪽 번호, 불러오는 중 · 실패(첨부 카드로 대체)                                                          | D 로딩 오류                      | 커스텀 (pdf.js 번들, 지연 로드 · 2026-11-24 결정)             | —    | P2   | Ready     |
| ED-MediaPlayer     | 비디오 / 오디오 블록 | video · audio 종류, 네이티브 컨트롤을 토큰 배경으로 감쌈, 캡션, 재생 불가(첨부 카드로 대체)                                                           | D H F X(재생 불가)               | 커스텀 노드 뷰(`<video>` · `<audio>`)                         | —    | P2   | Ready     |
| ED-Columns         | 단 나누기            | 2·3·4열, 열 블록 담기, 열 너비 손잡이(마우스 드래그), 좁으면 세로로 쌓임                                                                              | 손잡이 H(마우스 전용)            | 커스텀 노드 + 노드 뷰 (`columns > column{2,4} > 블록+`)       | —    | P2   | Ready     |
| ED-EmojiInline     | 본문 이모지          | 글자 크기(1em) 이모지 한 글자, 피커 트리거(슬래시 「이모지」)                                                                                         | D 선택                           | tiptap 커스텀 인라인 노드 + OV-EmojiPicker(L2 재사용)         | —    | P2   | Ready     |
| ED-DateChip        | 날짜 칩              | 상대 표시(오늘·내일·어제·N일 뒤), 지난 날짜 흐림, 알림 설정 표시(종 아이콘·EDIT-37), 누르면 날짜 팝오버                                               | D H F A(팝오버 열림) X           | 커스텀 인라인 노드 + 노드 뷰, UI-Calendar를 OV-Popover에 넣음 | —    | P2   | Ready     |
| ED-CalcLine        | 계산 줄              | 줄 끝 `=`에 결과(흐린 글씨, tabular-nums). 캐럿이 줄 끝이면 「Tab」 안내, Tab으로 본문에 넣기. 설정에서 끄면 숨김(`data-calc`)                        | D A(캐럿이 줄 끝) X(설정 끔)     | 커스텀 확장 + 위젯 장식(`calc-line.ts`), 계산은 `lib/calc`    | —    | P2   | Ready     |
| ED-TableOfContents | 목차 블록            | 본문 H1–H3을 들여쓴 계층 목록으로(라이브). 항목은 버튼(누르면 그 제목으로, 부드럽게·모션 줄이기면 즉시), 제목이 없으면 안내 문구. 카드 없이 왼쪽 선만 | —                                | tiptap 커스텀 노드(atom)                                      | —    | P2   | Ready     |

### EDIT-28~37 계획 메모 (2026-11-24)

- **ED-FileAttachment · ED-PdfViewer · ED-MediaPlayer Ready (2026-11-24, EDIT-31~33 컴포넌트 단계):** 노드·슬래시 연결은 2단계. 세 컴포넌트는 props와 콜백만 받는다(`resolveSrc`, `onOpen`·`onReveal`·`onDownload`·`onReplace`·`onRemove`, `missing`, `progress`). 크기 상한과 종류는 `src/lib/attachments/limits.ts`. 카드 키: Tab → Enter 열기, ⋯ 또는 메뉴 키(Shift+F10)로 메뉴. PDF: 영역에 포커스 후 ⌘+ · ⌘− · ⌘0, 쪽은 보이는 쪽만 그린다(글자 층 없음). 미디어: 플레이어 포커스 후 Space·K 재생, ← → 5초, M 음소거, F 전체 화면. 실제 앱 확인 필요: 저장 경로의 `convertFileSrc` 재생, Finder 열기.
- **재사용:** 페이지 아이콘 피커 `OV-EmojiPicker`(ED-EmojiInline), 경로 시각 `SH-Breadcrumb`(ED-Breadcrumb), 페이지 아이콘 `UI-PageIcon`(ED-SubpageBlock), 팝오버 `OV-Popover`(ED-DateChip). 본문에서 쓰는 노드는 모두 props와 콜백만 받는다(`lib/storage` 직접 호출 금지).
- **신규 L1:** `UI-Calendar`는 L6 `CL-CalendarView`가 L1–L4를 import할 수 없어 따로 만든다. 나중에 CL-CalendarView가 이 컴포넌트를 쓰도록 바꿀지 결정한다.
- **기존 것과 구분:** `PG-PdfPreview`는 PDF 내보내기 미리보기(DATA-06)라 ED-PdfViewer와 다르다. ED-Math(인라인·블록 수식, EDIT-16)는 이미 있으므로 새 블록을 만들지 않는다. ED-Image의 이미지 저장 경로(`assets/`)를 파일 첨부가 따른다(ADR-025 제안).
- **저장 형식:** 노드 속성에는 파일 경로(워크스페이스 기준)·이름·크기·종류만 둔다. 파일 자체는 페이지 JSON에 넣지 않는다.

### ED-ToggleHeading · ED-Columns 메모 (2026-11-24, phase 1 — 컴포넌트만)

- **ED-ToggleHeading 설계 결정:** ED-Toggle(Details) 재사용은 하지 않았다. Details의 요약은 `detailsSummary`(인라인)라 `heading`이 아니어서 목차(`getHeadings`)와 Markdown 제목 변환에서 빠진다. 별도 노드 `toggleHeading`(content `heading block*`)로 제목을 진짜 `heading`으로 두고, 열림 상태는 `open` 속성(`data-open`), 접힌 동안 뒤 블록은 ProseMirror 노드 장식 `hidden`으로 숨긴다(문서 JSON에는 장식이 없다).
- **목차·검색:** 접힌 제목도 목차에 남는다(제목은 보이는 줄이므로 이동 대상이 항상 보인다). 검색은 문서 글자를 그대로 본다.
- **ED-ToggleHeading 키보드:** ⌘⇧↵ = 캐럿이 든 토글 접기·펼치기(접을 때 캐럿이 숨은 내용에 있으면 제목 끝으로). 펼침 단추 = 마우스 클릭, 포커스 후 Enter·Space(이름 「토글」 고정, 상태는 `aria-expanded`; 툴팁은 「접기」「펼치기」). 화살표 회전은 `motion-reduce`에서 멈춘다. Enter: 접힌 제목 끝에서 Enter를 치면 아래 문단이 생기고 토글이 펼쳐진다(appendTransaction). Tab은 탭 문자(EDIT-22) 그대로.
- **ED-Columns 설계:** `columns`(content `column{2,4}`) > `column`(content `block+`, 비율 `width` = flex-grow). 열 안 Tab은 탭 문자(EDIT-22)라 열을 옮기지 않는다.
- **ED-Columns 키보드:** ⌘⌥←/→ = 앞·뒤 열 첫 줄로(끝 열에서는 멈춤), ⌘⌥⇧←/→ = 캐럿 열 폭 0.25씩(옆 열에서 가져옴, 최소 0.5). 손잡이는 마우스 전용(`aria-hidden`, 포인터 드래그 후 놓을 때 저장). 드래그는 `setPointerCapture`로 손잡이가 포인터를 잡고, mousedown 기본 동작을 막아 WebKit에서 텍스트 선택이 끼지 않는다. 끄는 중에는 손잡이가 포인트 색(`bg-accent`). 끄는 동안의 미리보기는 열 DOM의 style을 바꾸지 않고 `.sn-columns-body`의 CSS 변수(`--sn-col-N`, `.sn-columns-dragging`)로 보낸다. 열 style을 직접 바꾸면 ProseMirror가 열을 다시 그려 미리보기가 사라졌다(WebKit에서 확인).
- **좁은 폭:** 단 나누기 너비 32rem 아래에서 열이 세로로 쌓인다(컨테이너 쿼리). 그때 손잡이는 숨긴다.
- **경계 표시 (2026-11-26):** 열 사이 구분선은 평소에도 옅게 보인다(`bg-line`), 손잡이 위에서는 포인트 색(`bg-accent`). 단 나누기 위에 마우스를 올리면 열 영역이 `bg-hover`로 옅게 채워진다(editor.css).
- **드래그 핸들:** Tiptap DragHandle은 최상위 블록만 잡는다(`nested` 미사용). 단 전체는 핸들로 옮기고, 열 안 블록은 핸들이 없다.
- **phase 2 연결(다른 작업):** 확장 묶음(`extensions.ts`)에 `ToggleHeading`(`toggle-heading.tsx`, 이름 `toggleHeading`)과 `Columns`·`Column`(`columns.tsx`, 묶음 `columnExtensions`)을 넣고, 스토리용 `NoteEditor.extraExtensions` 경로는 그때 걷는다. 명령: `setToggleHeading({ level })`, `toggleToggleHeading()`, `insertColumns({ count })`, `setColumnWidths({ pos, widths })`, `moveToColumn(±1)`, `resizeColumn(±)`. Markdown은 아직 없다: 토글 제목은 `<details><summary>제목</summary>…</details>`(ED-Toggle과 같은 형식)로 낸다고 제안한다. 단은 Markdown에 대응이 없어 열을 위에서 아래로 펼치는 것을 제안(손실 명시)하며 확정은 phase 2에서 한다.

### EDIT-35~37 구현 메모 (2026-11-24, phase 1 — 앱 연결 전)

- **UI-Calendar:** `components/ui/calendar.tsx`. 직접 만들었다(react-day-picker 미추가). props: `value`, `onChange`, `min`, `max`, `weekStartsOn`, `today`, `defaultMonth`, `onEscape`, `label`. 키: 방향키 한 칸·한 주, Home/End 주, PageUp/PageDown 달, Shift+PageUp/Down 해, Enter·Space 고르기, Esc는 `onEscape`. 격자는 roving tabIndex, 행 키는 주의 첫 날짜(달이 바뀔 때 포커스 유지).
- **ED-DateChip:** 노드 `dateChip`(`components/editor/date-chip-node.tsx`, 원자 인라인). 속성: `date`(YYYY-MM-DD 로컬), `time`(HH:mm 또는 null), `reminder`(JSON: `{kind:"none"}` · `{kind:"morning"}` · `{kind:"custom",time}` · `{kind:"before",minutes:10|60|1440}`), `done`(bool), `created`(ISO 또는 null). HTML: `span[data-type="date-chip"]`, 속성 `data-date`·`data-time`·`data-reminder`(JSON)·`data-done`·`data-created`. 명령 `insertDateChip(attrs)`. 본문 글자는 상대 문구. 날짜·시각 계산은 `lib/dates/`(`formatDateLabel`, `computeReminderAt`, `reminderStatus`, `isOverdue`).
- **ED-DateChip 시각·알림:** 「시간 지정」 알림 시각은 칩 시각을 따라간다(칩에 시각이 없으면 09:00). 알림 시각을 따로 고치면 따라가지 않는다(`followChipTime`, `lib/dates/reminder.ts`). 저장 형식은 그대로라 기존 문서는 바꾸지 않는다. 팝오버의 알림 행 아래에 두 상태를 설명하는 한 줄이 붙는다.
- **ED-DateChip 알림 (phase 2):** 앱이 켜져 있을 때만 OS 알림. 스케줄러는 `computeReminderAt`으로 시각을 구하고, 지난 알림은 `reminderStatus === "passed"`로 다음 실행 때 앱 안에 보여 준다. 플러그인 추가·권한 안내·저장 위치는 phase 2.
- **ED-EmojiInline:** `components/editor/emoji-inline.tsx`(`EmojiInlinePopover`, `EmojiShortcodeMenu`). 이모지는 글자로 넣는다(노드 없음). 단축 코드 목록·매칭은 `lib/emoji/shortcodes.ts`(`matchShortcodes`, `nextActiveIndex`). phase 2: 슬래시 「이모지」에서 열고, EDIT-19(`:smile:`)와 역할을 정한다. 키 처리(위·아래·Enter·Esc)는 Tiptap 제안 플러그인의 `onKeyDown`에서 같은 도우미로 한다.
- **Markdown (phase 2 제안):** 날짜 칩은 `YYYY-MM-DD`(시각이 있으면 뒤에 `HH:mm`), 알림·완료는 잃는다고 명시. 이모지는 글자 그대로.
- **ED-Math:** 인라인 수식은 기존 `ED-Math`(EDIT-16)로 이미 Ready 이상(감사 완료). 새 ID를 만들지 않았다.

### L4 메모 (2026-11-19)

- **ED-SlashMenu:** 줄 처음이나 공백 뒤의 `/`에서 열린다(코드 블록·토글 제목 안에서는 열리지 않음). ↑↓ 이동, Enter·Tab 넣기, Esc 닫기. 프로토타입 `.slash`(폭 320, 행 50, 썸네일 40×30).
- **ED-SlashMenu 문법 위치 (2026-11-27, EDIT-07):** 목록 항목·체크리스트·인용·콜아웃·토글 본문·열·표 셀·제목 줄 어디서든 모든 항목이 동작한다(`slash-items.ts`의 `insertBlock`). 규칙: (1) `/검색어`는 항상 지운다. (2) 명령이 캐럿 자리에서 되면 그대로 쓴다(예: 문단을 인용으로 감싸기). (3) 스키마가 허용하지 않는 자리(목록 항목의 첫 문단 등)면, 캐럿이 있는 블록 바로 뒤에 새 블록을 넣되 허용되는 가장 안쪽 부모를 고른다(목록 항목이면 항목 안 문단 뒤). 캐럿은 새 블록 안으로 옮긴다. (4) 글은 지우지 않는다. 자리가 없는 항목은 두지 않는다 — 메뉴에서 숨기는 규칙은 쓰지 않는다(표 셀 안의 열도 셀 안에 들어간다). 단, 같은 블록 안에서 같은 항목(인용 안의 인용)을 고르면 한 겹 풀린다.
- **ED-FloatingToolbar:** 글자를 고르면 뜬다(코드 블록·표 셀 선택 제외, 표 편집 바와 겹치지 않음). ⌥F10으로 들어가 ←→ 이동, Esc로 본문 복귀. 프로토타입 `.floatbar`(높이 36, 버튼 28).
- **ED-BlockHandle:** 프로토타입 `.block-gutter`(아이콘 버튼 22×24). ＋는 빈 문단이면 그 자리에서, 아니면 아래에 문단을 만들고 슬래시 메뉴를 연다. 키보드로는 ⌘⇧↑ / ⌘⇧↓로 캐럿이 있는 최상위 블록을 옮긴다(`block-keys.ts`, 목록 안이면 목록 전체).
- **ED-BlockHandle 감사 (2026-11-22, EDIT-09):** 키보드로 도달 불가(Tab 순서 밖, hover 전용) → 높음이라 Ready로 되돌렸다가 ⌘/ 블록 메뉴로 해결. 메뉴는 캐럿이 있는 블록 옆에 뜨고 첫 항목에 포커스가 간다(↑↓·Home·End 이동, Enter 실행, Esc·Tab·바깥 누름은 닫고 캐럿으로 돌아간다). 항목은 ＋(아래에 블록 추가)와 ⋮⋮(블록 선택)과 같은 동작이다. 마우스 끌기(⋮⋮ 드래그)는 실제 앱에서 따로 확인해야 한다(미확인).
- **감사 메모 (2026-11-22, ED-SlashMenu · ED-FloatingToolbar · OV-ColorPopover · OV-LinkPopover · OV-CommandPalette):** 키보드(↑↓·Enter·Esc, ⌥F10 진입·←→·Esc 복귀, ⌘K·Esc 후 포커스 복귀), ARIA(listbox/option, toolbar, dialog 이름), 대비(라이트 5.1:1, 다크 6.1:1, 검색 강조 다크 약 5.5:1) 확인. 수정: 아이콘 14px→16px(툴바 블록 변환 chevron, 팔레트 바닥 안내, 색 확인 표시), 링크 팝오버 적용 버튼 상시 표시. 미확인: 플레이스홀더·H1–H3·목록의 실제 렌더(검사 문서에 해당 노드가 없었음).

### L4 감사 메모 (2026-11-19)

감사 결과 높음 2 · 중간 3 · 낮음 9. 높음·중간은 모두 고치거나 예외로 정했다. 라이트 스토리 테스트 93개와 다크 axe(L4 스토리 43개) 위반 0.

- **블록 핸들은 마우스용, 키보드는 같은 일을 다른 길로:** 핸들은 마우스를 올릴 때만 뜬다(Tiptap DragHandle이 키 입력 때 숨긴다). 키보드로는 ＋ = Enter 후 `/`, ⋮⋮ 끌기 = ⌘⇧↑↓, 블록 고르기 = ⇧ 방향키.
- **수식 편집:** 누르거나, 방향키로 고른 뒤 Enter. 수식 이름은 KaTeX의 MathML이 읽힌다.
- **팝업 포커스 복귀:** 서식 바의 블록 변환·링크·색 팝업은 적용하면 본문으로, Esc로 닫으면 트리거 버튼으로 포커스가 돌아간다.
- **본문 영역의 `outline-none`(예외):** 편집 영역은 화면의 주인공이라 테두리 링을 두르지 않는다. 캐럿이 포커스 표시다(프로토타입과 같음).
- **남은 낮음(나중에):** 토글 화살표는 예외로 둔다(2026-11-21 결정: ProseMirror가 직접 만드는 버튼이라 토큰 테두리로 그린 화살표를 유지, 이름은 `aria-label` "토글" 고정·`aria-expanded`로 상태), 넘치는 코드 블록·표 키보드 스크롤은 편집 중 캐럿 이동으로 스크롤되므로 두지 않는다, ~~표 삭제 뒤 실행 취소 토스트~~(2026-11-21 구현), 서식 바 roving tabindex, 링크 버튼 `aria-pressed`+`aria-expanded` 정리, 인라인 코드·첨자의 상대 글자 크기(`0.88em`·`0.75em`, 프로토타입 값)는 임의 값 예외로 둔다.

## L5 — 페이지 부품

| ID                 | 컴포넌트              | 내용                                                                                                                                                                                                                                                                                   | 시트 | 우선 | 진행      |
| ------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | --------- |
| PG-PageHeader      | 페이지 헤더           | 커버, 이모지 아이콘, 제목, hover 시 "아이콘 추가/커버 추가"                                                                                                                                                                                                                            | —    | P0   | 감사 완료 |
| PG-Properties      | 속성 영역             | 태그, 날짜, 상태 행                                                                                                                                                                                                                                                                    | §15  | P0   | 감사 완료 |
| PG-EmptyStart      | 빈 페이지 시작        | 빈 페이지 / 템플릿 버튼                                                                                                                                                                                                                                                                | —    | P0   | 감사 완료 |
| PG-Splash          | 첫 실행 스플래시      | 고래자리 별이 하나씩 켜지고, 별이 다 켜지면 radiant 빛이 번지며 선이 이어진 뒤 이름(약 2초 · 2026-11-20 빛을 더 오래 보이게) · 아무 키·클릭으로 건너뛰기 · 동작 줄이기면 바로 넘어감. 폴더 선택 화면과 별자리를 이어 쓴다(Motion `layoutId`) (DATA-03, 2026-11-19 사용자 결정)         | —    | P0   | Ready     |
| PG-WorkspaceSetup  | 첫 실행 폴더 선택     | 고래자리(md) · 제목 · 기본 위치에 만들기 / 다른 폴더 선택 · 지난 폴더 없음 · 로딩 · 오류 (DATA-03, 프로토타입 없음 → 기존 컴포넌트·토큰으로 조립, 2026-11-19 사용자 승인)                                                                                                              | —    | P0   | Ready     |
| PG-TrashPopover    | 휴지통 팝오버         | 검색, 목록, 복원/영구 삭제, 빈 상태                                                                                                                                                                                                                                                    | —    | P0   | 감사 완료 |
| PG-SettingsNav     | 설정 탭 목록          | 6개 탭(…· Agent / MCP)                                                                                                                                                                                                                                                                 | —    | P0   | 감사 완료 |
| PG-SettingsRow     | 설정 행               | 이름 + 설명 + 컨트롤                                                                                                                                                                                                                                                                   | —    | P0   | 감사 완료 |
| PG-McpStatus       | MCP 연결 상태         | 연결됨(초록) · 설정됨(파랑) · 연결 안 됨 · 확인 중(회색) 뱃지. UI-StatusChip을 쓰고 `role=status`로 바뀜을 알린다. 설정 「Agent / MCP」(DATA-12)                                                                                                                                       | —    | P1   | Ready     |
| PG-ThemeCard       | 테마 카드             | 라이트·다크·시스템 미리보기                                                                                                                                                                                                                                                            | —    | P0   | 감사 완료 |
| PG-AccentSwatch    | 포인트 색 견본        | 8종, 선택                                                                                                                                                                                                                                                                              | §18  | P0   | 감사 완료 |
| PG-TemplateCard    | 템플릿 카드           | 이모지·이름·설명·본문 미리보기(PG-DocPreview) · 오른쪽 위 ··· 메뉴(편집·복제·삭제, PAGE-14, hover·포커스·열림에서만 보임)                                                                                                                                                              | §17  | P1   | 감사 완료 |
| PG-TemplateGallery | 템플릿 갤러리         | 카테고리 + 카드 그리드 · 새 템플릿 버튼 · 빈 분류 안내                                                                                                                                                                                                                                 | §17  | P1   | 감사 완료 |
| PG-RecentCard      | 최근 페이지 카드      | 커버 썸네일, 제목, 시간(레코드면 "· 컬렉션 이름"), 컬렉션은 표 아이콘(kind)                                                                                                                                                                                                            | —    | P1   | Ready     |
| PG-TodayTodos      | 오늘의 할 일          | 페이지별 체크리스트 모음                                                                                                                                                                                                                                                               | —    | P1   | Ready     |
| PG-QuickNote       | 빠른 메모             | 입력, 저장, 페이지로 승격                                                                                                                                                                                                                                                              | §16  | P1   | Ready     |
| PG-Backlinks       | 백링크 목록           | —                                                                                                                                                                                                                                                                                      | —    | P2   | Ready     |
| PG-DocPreview      | 문서 미리보기         | 본문 앞부분을 블록 한 줄씩 작게 읽기 전용으로(제목 굵게, 목록·할 일 기호, 인용 선, 코드 고정폭), 빈 문서 안내. 에디터 없이 그린다 (PAGE-14)                                                                                                                                            | —    | P2   | 감사 완료 |
| PG-TemplateBar     | 템플릿 편집 띠        | 템플릿 문서를 열면 상단 바 아래: "템플릿 편집 중" · 분류(UI-Segmented) · 카드 설명 · 새 문서 제목(`{{date}}`) · 완료 (PAGE-14)                                                                                                                                                         | —    | P2   | 감사 완료 |
| PG-VersionHistory  | 버전 기록 대화상자    | 날짜별 버전 목록(오늘·어제·날짜 묶음, 시각 · 방금 전 · 글자 수) · 고른 버전 미리보기(맨 위 제목, 읽기 전용 본문은 바깥에서 넣음) · 이 버전으로 되돌리기(기본) · 닫기 · 목록 로딩·빈·오류 상태 · ↑↓ Home End로 고르기(listbox) (DATA-09, 프로토타입 없음 → 기존 컴포넌트·토큰으로 조립) | —    | P2   | 감사 완료 |
| PG-PdfPreview      | PDF 미리보기 대화상자 | 쪽마다 그린 그림을 세로로 미리 보기(브라우저 PDF 뷰어·안내 막대 없음) · 확대·축소·너비 맞추기(IconButton) · 준비 중 안내 · 저장 중 상태 · 실패 이유(웹 미리보기 등) · 닫기(기본) · PDF로 저장(준비됨일 때만) (DATA-06, 프로토타입 없음 → 기존 OV-Dialog·Button·토큰으로 조립)          | —    | P2   | 구현      |

### L5 메모 (2026-11-19)

- 파일: `src/components/page/`. 설정 선택지 목록(탭 5개, 포인트 색 8종)은 `options.ts`, 방향키 이동은 `roving.ts`.
- **PG-PageHeader:** 프로토타입 `.doc-head`(제목 40px/700/-0.02em, 아이콘 56px). 새 토큰 `--tracking-display`·`--fs-page-icon`·`--cover-max-h`. 제목은 `h1` 안의 `plaintext-only` 편집 칸(서식 붙여넣기 없음), Enter·끝에서 ↓로 본문으로. 아이콘·커버·템플릿 버튼은 머리 hover/포커스에 보인다. 커버는 P1(PAGE-03)이라 모양만.
- **PG-Properties:** 이름 칸 112px. 상태는 메뉴로 고르고, 태그 편집은 팝오버 내용을 부르는 쪽이 넣는다(태그 저장은 기능 단계). 표 역할(`table`/`row`/`rowheader`/`cell`).
- **PG-TrashPopover:** 영구 삭제는 행 안에서 “영구 삭제할까요? 취소/삭제”로 한 번 더 묻는다(기본 포커스는 취소 — Enter 한 번으로 지우지 않게. 취소하면 영구 삭제 버튼으로, 지우거나 복원하면 다음 행으로 포커스가 간다). 휴지통 이동의 실행 취소 토스트는 기능(PAGE-08)에서.
- **PG-SettingsNav:** 세로 탭(`tablist`), 방향키로 옮기면 바로 연다. 패널은 `settingsPanelId`로 연결한다.
- **PAGE-14 감사 (2026-11-21, UI 감사):** PG-TemplateCard·PG-TemplateGallery·PG-DocPreview·PG-TemplateBar. 높음 0. 중간 1: 카드의 ··· 버튼이 항상 보였다 → 반영(2026-11-21): 카드 hover·카드 안 포커스·메뉴 열림에서만 드러난다(취향 B의 hover-reveal 기준, Tab은 그대로 닿는다). 낮음 1: 갤러리 미리보기의 `{{date}}`는 오늘 날짜로 채운다 → 반영. 적용·템플릿 편집 띠·편집기는 원문 토큰을 그대로 둔다. 수정: 체크 표시 `strokeWidth` 3 → 1.5(규칙). 대비(WCAG AA): 텍스트 보조색 라이트 4.78 · 다크 6.43. 모션은 전역 `prefers-reduced-motion` 규칙이 맡는다.
- **PG-ThemeCard · PG-AccentSwatch:** 라디오 그룹. 미리보기와 점 색은 `data-theme`·`data-accent`로 실제 토큰을 쓴다(색 값을 적지 않음).
- 토큰 수정: `--sel-bg`·`--sel-fg`를 `:root`에서만 계산하던 것을 `[data-theme]`·`[data-accent]`에서도 다시 계산하게 했다(값은 그대로). 나란히 보기의 다크 열에서 선택 색이 라이트 포인트 색으로 남던 문제.

### PG-VersionHistory 감사 메모 (2026-11-21, DATA-09)

- 결과: 높음 0 · 중간 0 · 낮음 0. 항목 A–F와 접근성 점검을 코드와 웹 미리보기(키보드·DOM)로 확인했다. 스크린샷은 이 세션의 이미지 훅 문제로 찍지 않았다(DOM·접근성 트리로 확인).
- **목록은 listbox:** 행은 `role=option`·`aria-selected`, 고른 행만 `tabIndex=0`(roving). ↑↓는 고르면서 옮기고(끝에서 멈춤), Home·End는 처음·끝, Enter는 지금 행을 고른다. 되돌리기는 버튼으로만 한다.
- **미리보기는 바깥에서:** 본문은 읽기 전용 편집기(`NoteEditor editable=false`)를 `preview` 자리에 넣어 이 컴포넌트가 편집기·저장소를 import하지 않게 했다. 맨 위 제목은 이 컴포넌트가 그린다. 아이콘은 넣지 않았다(미리보기는 제목과 본문만).
- **글자 수·시각은 문자열로 받는다:** 날짜 묶음(오늘·어제·날짜)과 상대 시각은 `features/history/versions.ts`가 만든다.
- **예외:** 없음. 행 글자색은 `text-tertiary`(토큰), 목록 칸 너비는 PG-TemplateGallery와 같은 `calc(var(--spacing)*…)` 식을 쓴다.

### L5 감사 메모 (2026-11-19)

- 결과: 높음 0 · 중간 4 · 낮음 13. 중간 4개는 모두 고쳤다.
- 고친 것: 한글 조합 중 Enter(WebKit `keyCode 229`) 무시 · 영구 삭제 기본 포커스를 취소로 · 확인/삭제/복원 뒤 포커스 복귀 · 확인 문구 `role=alert` · 검색하면 확인 닫기 · 세로 탭은 ↑↓만(`rovingKey`의 `orientation`) · 제목 편집 칸을 `h1` 안 `span`으로 · 여러 줄 붙여넣기를 한 줄로 · 태그 편집 버튼 최소 폭 · 미리보기 막대 `rounded-hair`(OD `--r-hair`) · 포인트 색 견본 `auto-fit`(OD와 같음) · 설정 행 설명 id `${controlId}-desc`.
- 예외(그대로 둠):
  - 제목 편집 칸의 포커스 표시는 캐럿이다. 본문 편집 칸(L4 감사 완료)과 같다.
  - 30px 행·5px 미리보기 간격·미리보기 비율(34%·70% …)은 OD 값이다.
  - 문구는 앱의 해요체를 따른다(OD는 합니다체가 섞여 있음). 아이콘이 없을 때는 "아이콘 추가", 커버 버튼은 "커버 제거"로 대상을 밝힌다.
  - 커버 버튼 그림자는 `shadow-popover`. 커버는 P1이라 그때 다시 본다.
  - 카드 눌림 효과 없음(OD와 같음).

### 공통으로 정한 규칙·예외

- 누름 영역은 24px 이상 — 보이는 크기는 그대로 두고 `styles.ts`의 `hitArea`(투명 가상 요소)로 넓힌다. 예외: ED-BlockHandle ＋·⋮⋮(두 버튼이 붙어 있어 넓히면 겹침, WCAG 2.5.8 예외), ED-SlashMenu 목록(포커스는 에디터에 두고 `aria-activedescendant`).
- 하위 메뉴는 `sideOffset 6`·`alignOffset -4`(부모 메뉴와 2px 간격, 첫 항목을 트리거 행에 맞춤).
- 스토리의 토스트는 스토리마다 `Toaster id`·`toasterId`로 자기 토스트만 받는다.
- 알려진 불안정 테스트: `math.stories.tsx` › Keyboard Edit가 전체 실행 중 가끔 실패한다(혼자 실행하면 통과).

## L6 — 컬렉션 (P2)

컬렉션 = kind `collection`인 페이지, 레코드 = 그 아래 문서(2026-11-20 사용자 결정). 값 칸 편집기(상태·담당·마감)는 `components/collection/fields.tsx`에 두고 표·상세·PG-Properties가 함께 쓴다.

| ID               | 컴포넌트       | 내용                                                                                                                                                                                                                                                                                                                                                                                                               | 시트 | 우선 | 진행      |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- | --------- |
| CL-Toolbar       | 컬렉션 툴바    | 뷰 세그먼트 · 필터(칩, ×로 해제, 사용자 속성 포함) · 정렬 · 검색 · 개수 · 속성(CL-PropertyList) · 열기 방식 메뉴(COLL-07) · 새 레코드. 숨은 메뉴 없이 늘 보인다                                                                                                                                                                                                                                                    | §10  | P2   | 감사 완료 |
| CL-GridView      | 표 뷰          | 행 36px, 머리만 bg-subtle. 열 = 보이는 속성 순서, 머리 누르면 CL-PropertyMenu, 끝 ＋ 속성 추가(COLL-08). 제목 → 상세, hover "페이지로 열기", 값 칸 팝오버 편집, 보이는 행만 그린다(고정 36px 창, SYS-11), 바닥 "＋ 새 레코드" 줄은 늘 보임. 열 너비 조절(COLL-02): 머리 오른쪽 끝 손잡이(role=separator, 끌기는 손을 뗄 때 저장, ←/→ 16px·Shift 64px, 더블클릭은 기본 너비), 값은 칸 안에서 잘리고 전체 값은 title | §12  | P2   | 감사 완료 |
| CL-BoardView     | 보드 뷰 · 카드 | AppFlowy식: 카드에 "카드에 보이기"를 켠 속성(COLL-08), 칸 = 상태·담당·태그, 칸 색 바탕, 머리 계산·＋·메뉴(이름·색·계산·옮기기·숨기기·삭제), 바닥 "새 레코드", 카드 ··· 메뉴의 옮기기(⌥ 화살표 표시), 숨긴 칸, 끌 때 자리 미리 보기(끄는 카드를 흐리게, 원래 자리는 비움)·칸 안 순서, Alt+←/→/↑/↓, 카드 hover 동작, 칸마다 카드 50장까지 그리고 「더 보기」(SYS-11). CL-Card 포함                                   | §13  | P2   | 감사 완료 |
| CL-CalendarView  | 캘린더 뷰      | 월 7열(일요일 시작) 격자 · 주 보기(7열 1주), 시작~마감 막대, 몸통 끌어 옮기기·가장자리 손잡이(시작/마감), 빈 날 끌어 만들기, ⌥←/→ 키보드, 오늘 포인트 테두리, 칸 hover ＋로 그날 마감 레코드, +N개 더                                                                                                                                                                                                              | §14  | P2   | 감사 완료 |
| CL-RecordDetail  | 레코드 상세    | 모달(본문 폭) 또는 오른쪽 사이드 패널(COLL-07, Esc 닫기), 속성 행은 컬렉션 순서·이름 누르면 CL-PropertyMenu·아래 속성 추가, ‹ ›로 같은 필터 안 이동, 속성 · 체크리스트 진행률(UI-Progress) · 페이지와 같은 에디터                                                                                                                                                                                                  | §15  | P2   | 감사 완료 |
| CL-PropertyValue | 속성 값 칸     | 사용자 속성 값 하나. 글·숫자·링크·날짜 = 팝오버 입력(Enter 저장·Esc 취소), 체크박스 = UI-Checkbox, 선택 = 찾기 + 옵션(Enter로 새로 만들기), 만든·고친 날짜 = 읽기 전용                                                                                                                                                                                                                                             | —    | P2   | 감사 완료 |
| CL-PropertyMenu  | 속성 메뉴      | 이름 · 종류 · 옵션 이름 바꾸기/지우기 · 앞뒤로 옮기기 · 보드 카드에 보이기 · 숨기기 · 지우기(두 번 눌러 확인). 기본 속성은 이름·지우기 없음                                                                                                                                                                                                                                                                        | —    | P2   | 감사 완료 |
| CL-PropertyList  | 속성 목록      | 툴바 "속성" 팝오버. 모든 속성의 보이기 · 카드 표시 · 순서(손잡이 끌어 놓기 — 끄는 줄 흐림 + 놓을 자리 미리보기, 키보드는 손잡이에서 Alt+↑/↓), 이름 → CL-PropertyMenu, 맨 아래 속성 추가                                                                                                                                                                                                                            | —    | P2   | 감사 완료 |
| CL-AddProperty   | 속성 추가 메뉴 | 종류 11가지 메뉴. 표 머리 ＋ · 상세 · 속성 목록에서 연다                                                                                                                                                                                                                                                                                                                                                           | —    | P2   | 감사 완료 |

---

### 2026-11-20 COLL-07·08 감사 메모

대상: CL-PropertyValue·Menu·List, CL-AddProperty, 바뀐 CL-Toolbar·GridView·RecordDetail(사이드 패널)·Card, SH-Resizer(edge left). 결과 높음 0 · 중간 8 · 낮음 12. 고친 것: 사이드 패널 포커스 이동·복귀, 팝오버 안 가짜 메뉴 역할, listbox 자식, 토글 이름 고정(aria-pressed), 아이콘 버튼 UI-Tooltip, 속성 메뉴 Esc = 이름 취소, 표 칸 입력 이름에 레코드 이름. 남긴 것: 기존 "보드 설정" 이름(Label in Name), 4px 밖 높이(h-6.5·h-7.5는 기존 컨트롤 규격), SH-Resizer 포커스 선, 사이드 패널 폭 인라인 스타일(런타임 값). OpenDesign 비교는 생략.

### 2026-11-20 변경분 감사 메모

대상: CL-BoardView, SH-WorkspaceSwitcher(+ 새 워크스페이스 대화상자), UI-Constellation(radiant), PG-RecentCard, CL-GridView 바닥 줄, 사이드바 조립. 결과는 높음 0 · 중간 5 · 낮음 19였다.

| 구분          | 내용                                                                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 고침 (중간)   | 보드 칸·카드 ··· 메뉴에 툴팁을 달았다. 카드 오른쪽 여백을 `pr-16`으로 넓혀 hover 알약이 제목을 덮지 않게 했다. 카드 메뉴에 옮기기 4가지를 넣고 ⌥ 단축키를 함께 보인다. radiant 그라데이션 색은 `style`로 옮겼다(WebKit의 표시 속성 `var()` 대비).    |
| 확인만 (중간) | radiant 애니메이션 20개는 측정 결과 프레임 8.3ms로 문제가 없다. 블러 필터는 쓰지 않는다.                                                                                                                                                             |
| 고침 (낮음)   | 표 바닥 줄 높이를 행과 같은 `min-h-9`로 맞췄다. 보드 바닥 문구를 표와 같은 "새 레코드"로 바꿨다. 최근 항목 빈 문구를 "최근에 연 항목이 없어요."로 바꿨다. 새 워크스페이스 입력에 `name`·`autoComplete="off"`를 붙이고 placeholder 끝에 `…`를 넣었다. |
| 남긴 낮음     | 메뉴 행 `py-1.5`(공용 메뉴 값), 보드 26px 컨트롤 `h-6.5`(IconButton 크기와 맞춤), 최근 카드 아이콘 12·20px(프로토타입 값), 워크스페이스 체크와 최근 항목 컬렉션 이름을 `shortcut` 슬롯에 둔 것(오른쪽 정렬 용도), 잘린 이름의 `title` 속성           |

### 2026-11-22 P2 컬렉션 완료 점검 감사 메모

대상: CL-Toolbar, CL-GridView, CL-BoardView·CL-Card, CL-RecordDetail(감사 완료), 속성 계열(CL-PropertyValue·Menu·List·AddProperty)은 grep 점검만 했다. 화면 `collection-view.tsx`·`collection-properties.tsx`·`record-fields.tsx`도 같이 봤다. 네 관점(취향·인터페이스·디자인 일치·프로젝트 규칙)으로 봤다. OpenDesign 비교는 생략했다. 검사 방식: 하드코딩 값·아이콘 크기·hover 짝·레이어 import는 grep, 키보드·포커스·이름·진행률·드래그·1440/1024 폭·라이트/다크는 브라우저 DOM 확인(스크린샷 없음).

결과: 높음 0 · 중간 4 · 낮음 4(허용 항목 제외). 고친 것: 레코드 상세를 닫으면 포커스를 열었던 표 칸·보드 카드로 돌린다(`collection-view.tsx`, 기존 `useRestoreFocus` 재사용). 보드 카드 "페이지로 열기" 이름에 레코드 제목을 넣어 표와 같은 형식으로 맞췄다.

**속성 계열 감사 (CL-PropertyValue · Menu · List · AddProperty):** 결과 높음 0 · 중간 3 · 낮음 1로 시작했고, 중간 3개를 고쳤다. (1) 글·숫자·링크·날짜 입력의 Esc가 Radix 닫힘 경로에서 저장되던 문제를 `onEscapeKeyDown`으로 취소로 바꿨다(이름 바꾸기와 같은 규칙). (2) 숫자 칸에 숫자가 아닌 값을 넣으면 값을 조용히 지우던 문제를 `role=alert` 오류("숫자만 입력해요")로 바꾸고 팝오버를 닫지 않는다. (3) 선택 목록을 listbox로 두고 버튼에 option을 달았으나 화살표 키가 없어 `group` + `aria-pressed`로 바꾸고, 일치하는 옵션이 없을 때 빈 상태 문구를 더했다. 속성 목록의 위·아래 버튼은 맨 끝에서 disabled가 되면 누르는 순간 포커스를 잃어서 `aria-disabled`로 바꿔 포커스를 남겼다. 남긴 것: 속성 메뉴의 "한 번 더 누르면 지워요" 확인 상태는 메뉴를 다시 열 때만 초기화된다(의도된 동작). 검사 방법: 타입·린트 통과, Debug 화면에서 글 입력 Esc 취소·Enter 저장, 숫자 오류 표시를 DOM으로 확인(스크린샷 없음). OpenDesign 비교는 생략.

| 구분        | 내용                                                                                                                                                                                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 고침 (버그) | 레코드 상세 닫기 뒤 포커스가 BODY로 사라짐 → 여는 칸으로 복귀(Esc·닫기 모두 확인).                                                                                                                                                                                                                                                  |
| 고침 (중간) | 보드 카드 "페이지로 열기"가 같은 이름으로 여러 개 읽힘 → "“제목” 페이지로 열기".                                                                                                                                                                                                                                                    |
| 남긴 중간   | 단일 선택 메뉴(상태 고르기·정렬·열기 방식)가 menuitemcheckbox로 읽힌다 → menuitemradio로 바꿔야 한다(RadioGroup 전환, 결정 필요). 표에 화살표 키 셀 이동이 없다(Tab만, 키 설계 결정). 1024 폭에서 표가 안쪽 가로 스크롤로 오른쪽 열이 잘린다(결정 필요). 레코드 상세의 "2 / 3" 페이저에 aria-live=polite가 붙어 바뀔 때마다 읽힌다. |
| 남긴 낮음   | 속성 이름 칩 아이콘 14px(`size-3.5`)와 툴바 칩 14px가 밀집 행 예외에 드는지 확인 필요. 표 머리 이름에 "속성 메뉴"가 붙는다. 행 이름이 셀 내용을 모두 이어 붙인다. 보드 칸 정렬 `Alt+↑/↓`는 그대로 둔다.                                                                                                                             |

### 2026-11-22 COLL 키 이동 · 라디오 메뉴 · 고정 제목 열 (COLL-02·06·07·08 검증)

- **고침:** 표는 `role=grid`로 바꿨다. Tab 정지점은 한 곳이고 ↑↓←→로 셀을 옮기며 Home/End(Ctrl+Home/End는 표 처음·끝), Enter·F2는 값 칸 메뉴를 연다. 제목 칸의 Enter는 레코드를 연다(인라인 제목 편집이 없어서). Shift+Enter는 페이지로 연다. Esc는 메뉴를 닫고 같은 셀로 돌아간다. 메뉴에서 고르면 같은 셀에 머문다(아래 칸으로 내려가지 않는다). 글자 키로 편집을 시작하는 기능은 넣지 않았다. 셀 포커스 링은 `focusRing`(버튼 없는 칸도 링이 보인다). 제목 열은 좁은 폭에서 가로 스크롤 중에도 왼쪽에 붙고, 스크롤된 동안만 `border-line` 가장자리 선을 준다(그림자 토큰은 팝오버·모달용이라 쓰지 않았다).
- **라디오:** `DropdownMenuRadioGroup`·`DropdownMenuRadioItem`을 `ui/dropdown-menu.tsx`에 추가했다(체크박스 항목과 같은 모양). 단일 선택 7곳(상태, 정렬 필드·방향, 칸 나누기, 열기 방식, 카드 색, 계산)을 `menuitemradio`로 바꿨다. 필터(여러 개 고름)는 체크박스로 둔다. 페이지 계층의 상태 메뉴(`components/page/properties.tsx`)는 컬렉션 계층이 아니라서 그대로 두었다.
- **검증 (Playwright, DOM·접근성·computed style만):** 셀 이동·Enter·Esc·Home/End·Ctrl+End·단일 탭 정지점·`role=grid`·`aria-rowcount/colcount` 확인. 필터 4 → 1 → 4(칩 표시·풀기), 정렬·열기 방식 라디오 상태 확인, 새 탭 열기 시 탭 생성과 같은 레코드 재열기 시 활성화(중복 없음). 속성 11종 값 입력(텍스트·숫자·선택·다중 선택·날짜·체크박스·URL·이메일·전화), 만든·고친 날짜는 읽기 전용. 캘린더 날짜 칸 ＋로 그날 마감 레코드 생성과 상세 열림. 좁은 폭(760px) 스크롤 200에서 제목 칸 left 유지.
- **감사:** 네 관점으로 봤고 높음 0. 셀 포커스 링은 감사 중에 추가했다.
- **남긴 것:** 상태 칸에서 이미 고른 상태를 다시 고르면 비우는 동작(기존 체크박스 때와 같은 호출)이 DOM에서 "할 일"로 남았다. 원인은 아직 모른다. ⌘ 뒤 탭 열기는 미확인. 실제 데스크톱 앱의 키보드 동작은 미확인.

## 화면 → 컴포넌트 (조립 확인용)

| 화면             | 필요한 컴포넌트                                                          | 관련 기능         |
| ---------------- | ------------------------------------------------------------------------ | ----------------- |
| 1. 메인 편집     | SH-_, PG-PageHeader, PG-Properties, ED-_                                 | SHELL, PAGE, EDIT |
| 2. 집중 모드     | SH-TopBar, ED-*                                                          | SHELL-10          |
| 3. 슬래시 메뉴   | ED-SlashMenu                                                             | EDIT-07           |
| 4. 플로팅 툴바   | ED-FloatingToolbar, OV-ColorPopover, OV-LinkPopover                      | EDIT-08           |
| 5. 명령 팔레트   | OV-CommandPalette, UI-Kbd                                                | SRCH-01           |
| 6. 컨텍스트 메뉴 | OV-Menu                                                                  | PAGE-05           |
| 7. 빈 상태       | PG-EmptyStart, PG-TemplateGallery                                        | PAGE-06, PAGE-07  |
| 8. 홈            | PG-RecentCard, PG-TodayTodos, UI-TagChip                                 | SHELL-13          |
| 9. 설정          | OV-Dialog, PG-SettingsNav, PG-SettingsRow, PG-ThemeCard, PG-AccentSwatch | SET               |
| 10. 휴지통       | PG-TrashPopover                                                          | PAGE-08           |

### PAGE-10 감사 메모 (2026-11-20, OV-IconPicker · UI-PageIcon)

| 구분               | 내용                                                                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 고친 것            | 업로드 중 `disabled` → `aria-disabled`(포커스 유지), 팝오버를 닫으면 돌던 업로드 결과는 버림, 링크 칸 `aria-invalid`·오류 연결, "올리는 중"·검색 결과 없음 `role="status"`, 아이콘 이름 중복 2개 정리, 이미지를 못 읽으면 "이미지 없음" 아이콘, 오류 문구 `text-pretty`, 피부색 버튼 hover 토큰 |
| 남긴 것(낮음)      | 최근 올린 이미지 이름은 순서 번호, 아이콘이 없을 때 색 칸은 다음에 고를 색만 바꿈, `size-[1em]`·`align-[-0.125em]`(em 값)                                                                                                                                                                       |
| 2026-11-21 고친 것 | 최근 이모지를 한국어 이름으로 읽음(이모지 데이터에서 찾음), 무작위는 창을 닫지 않고 저장만(다시 눌러 바꾸기 — 되돌리기 대신), 아이콘 격자 Home·End·⌘Home·⌘End                                                                                                                                   |
| 확인 못 함         | OpenDesign 비교, 실제 앱(Tauri)에서 이미지 링크 내려받기                                                                                                                                                                                                                                        |

### 2026-11-21 슬래시 명령 전체 검사 (ED-SlashMenu)

| 항목      | 내용                                                                                                                                                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 테스트    | 단위 `slash-items.test.ts` 104개(이름·낱말·단축 입력 검색, 순서, 데이터 무결성) + 스토리 12개(16개 명령 Enter·클릭·Tab, 키보드 이동·스크롤, 실시간 거르기, 열리는/안 열리는 곳, 다른 블록 안 실행, 실행 취소, 이미지 고르기, 읽기 전용, 수식 흐름) |
| 고친 버그 | 이름에 띄어쓰기가 있는 명령(`/제목 1`, `/코드 블록` 등 7개)을 끝까지 치면 메뉴가 닫힘 → 공백 뒤에도 맞는 항목이 있으면 열어 둠                                                                                                                     |
| 고친 버그 | 목록·체크리스트 안에서 메뉴 Enter가 새 줄을 만듦 → 슬래시·멘션 제안 확장 우선순위 1000                                                                                                                                                             |
| 고친 버그 | 수식 적용 뒤 수식이 선택된 채 남아 다음 글자에 덮임 → 캐럿을 수식 뒤로. 빈 수식을 취소하면 지우고 에디터로 포커스                                                                                                                                  |
| 고친 것   | `/list`·`/checklist`로 체크리스트가 안 나옴 → 낱말 추가                                                                                                                                                                                            |
| UI 확인   | 미리보기 라이트·다크, 화면 아래쪽에서 위로 뒤집힘, 결과 없음 안내. 빈 목록 항목에서 블록 명령은 그 줄을 바꾼다(코드 블록은 목록 밖으로)                                                                                                            |

### 2026-11-21 Tab 들여쓰기 · 화면 크기 감사 메모 (ED-TabIndent, SHELL-17)

| 항목          | 내용                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 결과          | 높음 1 · 중간 3 · 낮음 6                                                                                                                                                                                |
| 고친 것       | (높음) Tab이 본문에 머무르는데 나가는 방법이 단축키 목록에만 있음 → 처음 들여쓸 때 한 번 안내 토스트(aria-live). 중복 `white-space: pre-wrap` 제거(ProseMirror 기본), 끝 도달 문구 "최대·최소 크기예요" |
| 확인한 것     | 1024 폭 설정 창에서 화면 크기 6칸 넘침 없음, 토스트 `aria-live="polite"`                                                                                                                                |
| 남긴 것(낮음) | `tab-size: 2em`(em 값 예외), 설정 설명의 단축키를 평문으로 표기, 80% 하한 가독성(사용자 판단), 미리보기 CSS zoom과 앱 웹뷰 배율 차이, 다크 사이드바 대비(이번 변경과 무관 — 별도 측정 필요)             |

### 2026-11-21 찾기 막대 감사 메모 (ED-FindBar, EDIT-25)

| 심각도         | 항목                                                                           | 결정                                                                          |
| -------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 높음           | 없음                                                                           | —                                                                             |
| 중간           | 입력 칸이 UI-Input과 다른 모양                                                 | UI-Input(`inputClass`) 그대로로 고침                                          |
| 중간           | 스토리 설명이 옛 테두리 방식                                                   | "채움"으로 고침                                                               |
| 중간           | 막대가 좁은 폭·긴 제목에서 페이지 머리를 가릴 수 있음                          | 떠 있는 막대(편집기들과 같은 방식)로 둔다. 가리면 Esc로 닫는다                |
| 낮음           | 결과 수 칸 폭 흔들림 · 펼친 상태 툴팁 단축키 · 검색 칸 속성 · 바꾸기 안내 문구 | 고침(w-16, 펼칠 때만 ⌥⌘F, autoComplete·spellCheck·enterKeyHint, "바꿀 내용")  |
| 낮음           | 결과 0일 때 이전/다음 disabled로 포커스가 빠질 수 있음                         | 그대로 — 결과는 찾기 칸에서 입력할 때 바뀌어 포커스가 버튼에 있는 일이 드물다 |
| 낮음           | `pl-7.5`(30px)                                                                 | 펼침 버튼(26px)+gap 4px 정렬 값, 주석으로 남김                                |
| 낮음(취향)     | 찾기 주황과 형광펜 노랑 구분                                                   | 지금 결과는 포인트 색 채움이라 구분된다. 일반 결과는 지켜본다                 |
| (감사 중 발견) | 코드 블록에서 지금 결과 글자가 문법 색이라 대비 미달(axe)                      | 글자 색을 강제(`text-accent-fill-on!`)                                        |

### 2026-11-21 목차·페이지 메뉴 감사 메모 (OV-Outline, PAGE-11, PAGE-12)

| 심각도 | 항목                                                                                   | 결정                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 높음   | 메뉴 항목의 키보드 하이라이트가 배경(hover)뿐이라 대비 약 1.1:1 — 모든 메뉴 공통(기존) | 고침: `menuItem`에 안쪽 포커스 링(--accent 2px, focus-visible). 마우스로만 쓸 때는 링이 없다. 팔레트는 항목 포커스가 없어 그대로 |
| 중간   | 목차 스토리에 다크·Esc 복귀 검사 없음                                                  | 추가(Dark, EscapeReturns)                                                                                                        |
| 중간   | 스크린샷이 옛 동작(첫 항목 강조)                                                       | 다시 찍어 지금 제목 포커스 확인                                                                                                  |
| 중간   | 상단 바 버튼이 늘어 1024 폭 겹침 미확인                                                | 1024 폭에서 겹침·잘림 없음, 제목 이동 후 상단 바에 가리지 않음 확인                                                              |
| 낮음   | 지금 제목의 굵기 차이가 약함                                                           | 그대로 — 포인트 색과 aria-current가 신호를 맡는다                                                                                |
| 낮음   | 체크 위치가 아이콘 유무로 다름                                                         | 의도(아이콘 줄 맞춤). OV-Menu 행에 적어 둠                                                                                       |

### SHELL-18 태그 관리 감사 메모 (2026-11-22)

- 결과: 높음 1 · 중간 4 · 낮음 4 → 높음·중간은 모두 고쳤다(웹 미리보기 DOM·키보드 확인, 스크린샷 미촬영).
- **고친 것:** 태그 보기 ··· 버튼의 `noTooltip` 제거(툴팁 규칙, 높음) · 색 ▸ 항목을 `DropdownMenuCheckboxItem`으로 바꿔 `aria-checked`를 준다 · 대화상자 버튼을 "이름 바꾸기 · 태그 합치기 · 태그 삭제"로 동사+대상 · 메뉴가 대화상자를 열면 메뉴 복귀 포커스가 대화상자 입력을 빼앗던 문제 · 메뉴에서 연 대화상자를 닫으면 메뉴를 연 행으로 포커스 복귀(`useRestoreFocus` fallback) · ··· 버튼·설정 태그 행에 `aria-haspopup="menu"`.
- **확인한 것:** 색 바꾸기(점 색 변경, 체크 표시), 이름 바꾸기 → 이미 있는 이름이면 "합칠까요?" + 합치기, 토스트 "‘미팅’으로"(받침 규칙), 합치기 → 실행 취소 복원, 삭제 → 실행 취소 복원, 설정 대화상자 위 중첩 대화상자의 포커스 가둠(Tab 순환)과 Esc 뒤 행 복귀, 키보드 Shift+F10 → 화살표 → Enter → 입력 포커스.
- **예외:** 태그 보기 header의 `max-w-240`은 이 작업 이전부터 있던 값이라 그대로 둔다. 아래 여백(`pb-[30vh]`)은 SHELL-13에서 넘칠 때만 펼치는 tail(`use-bottom-tail.ts`)로 바꿨다.
- **2차 정리 (2026-11-22, 해결):** 이름 바꾸기 뒤 포커스를 새 이름의 행(사이드바·설정, `data-tag-anchor`)이나 태그 보기 ··· 버튼으로 돌린다 · 토스트 조사는 `lib/josa.ts`(`roParticle`)가 한글 받침·숫자 읽기·영문 글자 읽기로 고르고, 판단할 수 없으면 "(으)로" · 합치기 대화상자에 검색(초성 검색 포함, ↓/↑·Enter, 결과 없으면 "맞는 태그가 없어요") · 이름 바꾸기에서 빈 이름이면 "이름을 입력해 주세요"(`aria-describedby`).

### SHELL-18·SHELL-13 감사 메모 (7c6c226 · e994c01, 2026-11-22)

- **결과:** 높음 0 · 중간 1 · 낮음 4. 중간은 고쳤다(웹 미리보기 DOM·키보드 확인, 스크린샷 미촬영).
- **고친 것 (중간):** 합치기 검색 칸의 `aria-expanded`가 결과 없을 때도 `true`이고 `aria-controls`가 없는 목록을 가리켰다 → 결과가 있을 때만 `true`·목록 연결.
- **확인한 것:** 합치기 listbox 구조(combobox·`aria-controls`·`aria-activedescendant`·option `aria-selected`), ↓/↑ 순환, 초성 검색(`ㅁㅇ` → 모임), 결과 없음 문구, 결과 없을 때 Enter 무시, 이름 바꾸기 뒤 새 이름 행으로 포커스(포커스 링 보임), 빈 이름 힌트 `aria-describedby` 연결·버튼 비활성, 닫기 버튼 이름 "닫기", 힌트·결과 없음·개수 글자 대비(라이트 5.1–7.8, 다크 6.1–8.2, AA 충족), 1440·1024 폭 가로 스크롤 없음, 홈 아래 여백 tail: 넘치지 않으면 숨김, 넘치면 `h-16`(64px), 크기를 되돌려도 흔들리지 않음. 변경 줄에 px·hex·인라인 스타일 없음. 토큰 간격 `--s*` 매핑 확인.
- **남긴 것 (낮음):** `aria-selected:bg-hover`에 `force-hover` 짝이 없다(선택 상태라 Debug 강제 대상이 아님) · 태그 보기 tail의 넘침 경로는 미확인(태그 한 개뿐이라 넘치지 않음) · 힌트 입력에 `aria-invalid`가 없다(필드 오류가 아니라 안내라 생략) · 합치기 대상이 자기 하나뿐일 때의 "합칠 다른 태그가 없어요." 문구는 코드만 확인.

### 감사 메모 (2026-11-22, P1 배치 B · EDIT-13~26)

- 네 관점(취향·위계, 인터페이스 품질, 디자인 일치, 프로젝트 규칙)으로 감사했다. 디자인 일치(OpenDesign 비교)는 하지 못했다.
- **ED-TableMenu (감사 완료):** 높음 1 해결 — ⌥F10으로 표 도구 모음(role=toolbar, "표 도구")에 들어가 ←→ Home End로 옮긴다(로빙 탭인덱스). Enter·Space는 실행 후 포커스를 단추에 두고(표가 사라지면 본문), Esc는 같은 셀의 본문 커서로 돌아간다. 글자를 고른 상태는 서식 바가 ⌥F10을 받는다. 나머지 버튼은 레이블·툴팁·포커스 링이 있다.
- **ED-Table (키보드, EDIT-15):** ⌘A(Windows·Linux Ctrl+A)는 셀 안에서 셀 본문 전체(여러 문단이면 첫 글자~마지막 글자)를 고른다. 이미 다 고른 상태면 문서 전체. 빈 셀은 첫 번째 누름을 삼키고 같은 셀에서 두 번째 누름부터 문서 전체. 여러 셀(CellSelection)을 고른 상태와 표 밖은 문서 전체. 구현 `editor/table-select-all.ts`(우선순위 1000), 단위 테스트 `table-select-all.test.ts`, 스토리 play `ED-Table/SelectCellContent`.
- **ED-PageMention (감사 완료):** 중간 1 확인 — 제안 목록은 처음부터 편집기에 aria-controls · aria-activedescendant · aria-autocomplete를 달고(CaretPopup, 슬래시 메뉴와 같은 패턴), 고른 항목의 aria-selected를 맞춘다. 높음 0. 스토리(ActiveOption)가 ↓↑ 이동과 닫힐 때 연결 제거를 검사한다. aria-expanded는 textbox에 쓸 수 없어(axe) 넣지 않는다.
- **ED-FindBar (감사 완료 유지):** 찾을 글자 칸 레이블, 결과 `aria-live`, ⌥⌘F 바꾸기 칸과 `aria-expanded`를 확인했다. 찾기·다음·바꾸기·모두 바꾸기와 실행 취소 한 번을 동작으로 확인했다.
- **ED-Image (Ready 유지):** 가져오는 중 자리는 `role="img"` + `aria-busy`, 실패 자리는 `ImageOff` + 레이블이다. 가져오는 순간을 DOM으로 잡지 못했고, 실제 내려받기는 Tauri 백엔드가 필요하다 → 실제 앱 확인 필요.
- **색 확인:** 찾기 막대의 라이트·다크 계산 색(배경·글자)은 토큰 값과 맞다. DOM 수치 확인이며 스크린샷 확인은 아니다.

### 감사 수정 메모 (2026-11-24, UI 감사 수정 묶음)

고친 항목의 요약이다. 진행 상태(`Ready`·`감사 완료`)는 바꾸지 않았다. 이 문서에는 수정으로 상태를 되돌리는 규칙이 없다.

- **ED-CodeBlock:** 코드 면 색 토큰을 `--color-code-surface`(`bg-code-surface`)로 바꿨다. `text-code`(13.5px)와 같은 이름이 겹쳐 코드가 16px로 그려지던 문제를 막는다. 언어 선택 칸은 고른 이름 길이에 맞추고, 화살표는 lucide chevron을 쓴다.
- **ED-CodeBlock (SYS-11):** 하이라이트는 Tiptap 기본 lowlight 플러그인 대신 `editor/code-highlight.ts`의 증분 플러그인을 쓴다. 바뀐 범위와 겹치는 코드 블록만 다시 칠한다(`code-highlight.test.ts`가 전체 재계산과 같음을 확인). 노드 뷰(`CodeBlockView`)는 그대로다. 노드 뷰 생성은 블록당 약 1.6ms라 열기 비용의 주원인으로 남았다(10k 블록 열기 16초, 측정). 저장된 언어 줄임말(`ts`·`py`)을 목록 이름으로 고치는 정리는 블록마다 트랜잭션을 보내던 것을 한 트랜잭션으로 모은다(실행 취소 기록 없음, 2026-11-27). 블록마다 보내면 트랜잭션마다 하이라이트 전체 재계산·본문 비교가 돌아 O(n²)이 됐다: 코드 블록 833개가 든 5000블록 문서의 첫 열기가 프로덕션 20.7초 → 1.3초(`code-block-open.browser.spec.tsx`가 한 트랜잭션을 고정).
- **ED-TableMenu · ED-FloatingToolbar:** 위치는 편집기 스크롤 영역(상단 바 아래) 안에서 기준 사각형에 붙이고, 자리가 없으면 뒤집고(flip) 가장자리에서 밀어낸다(shift). 계산은 공용 헬퍼 `src/components/editor/floating-bounds.ts`를 쓴다.
- **ED-FindBar:** 찾기 줄과 바꾸기 줄이 같은 격자(shared grid)를 쓰고, 조작 칸은 28px다.
- **CL-CalendarView:** 칩에 전체 제목을 title로 붙여 잘린 제목을 hover로 읽는다.
- **CL-CalendarView (2026-11-27):** 시작~마감 기간은 주(7칸)마다 조각 막대로 나뉘고, 주 경계에서 잘린 쪽은 네모, 실제 끝만 둥글다. 겹치는 막대는 줄을 바꾸고(최대 3줄), 넘치면 칸에 "+N개 더". 막대 조각마다 제목을 그대로 보여 준다(줄이 바뀌어도 어느 일인지 읽히게). 레이아웃은 `features/collection/calendar-span.ts`(순수 함수)가 한다.
- **CL-RecordDetail:** 태그 칸의 안쪽 여백을 값 열(`px-2`)과 맞췄다.
- **PG-Properties:** 「수정한 날짜」는 절대 날짜로 보여 준다. 상대 시간은 title에 둔다.
- **OV-IconPicker · OV-EmojiPicker:** 검색 칸 너비를 `w-56`으로 고정해 탭을 바꿔도 너비가 달라지지 않는다.
- **SH-PageTree:** 페이지·폴더·컬렉션 행 아이콘을 14px로 맞춘다.
- **SH-SidebarSection · SH-PageTabs:** 섹션 액션 버튼과 탭 닫기 칸을 24px 맞춤 영역으로 키웠다.
- **SH-Resizer:** 키보드 포커스에 focus-visible 링을 추가했다.
- **UI-SearchInput:** 지우기 버튼 맞춤 영역을 24px로 키웠다.
- **PG-TodayTodos:** 체크박스와 제목의 맞춤 영역을 24px로 키웠다.
- **PG-RecentCard:** 잘린 제목에 전체 제목을 title로 붙였다.
- **PG-QuickNote:** 메모 입력의 기본 크기 손잡이를 끈다(`resize-none`).
- **PG-WorkspaceSetup:** 폴더가 없을 때의 안내에 「폴더 다시 찾기」 동작을 넣었다.
- **OV-CommandPalette:** 잘린 행에 title을 붙였다. 하단 힌트는 강조된 행에 따라 「만들기」 또는 「열기」로 바뀐다.
- **SH-WorkspaceSwitcher:** 스토리에서 메뉴를 열어 둔 상태를 그린다(Delete 힌트를 보기 위해서다).
- **OV-Toast:** 쌓인 실행 취소 토스트는 펼쳐 보이고, 최대 3개까지 보인다. 다운로드 토스트에는 UI-Progress 막대가 있다.
- **OV-Dialog:** `scrollable`일 때 × 닫기 버튼은 고정된다. 머리글 행은 `DialogHeaderRow`로 묶어 닫기 칸 자리를 남긴다. 메뉴에서 연 대화상자는 닫을 때 `use-restore-focus`로 연 곳에 포커스를 돌려준다.
- **PG-VersionHistory:** 열릴 때 초기 포커스는 선택된 버전 행이다.
- **PG-TemplateCard:** 설명은 5줄까지 보이고 아래는 fade로 가린다. 숨은 메뉴 버튼은 드러나기 전까지 클릭되지 않는다.
- **PG-TemplateGallery:** 빈 카테고리 상태는 20px 아이콘 · 안내 문구 · 「새 템플릿」 버튼으로 구성한다.
- **UI-Progress:** OV-Toast의 다운로드 토스트에서 쓴다. `aria-label` 또는 `aria-labelledby`가 필수다.
