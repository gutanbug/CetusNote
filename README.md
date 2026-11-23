# Cetus Note

흩어진 생각을 잇는 개인용 노트 앱. 데스크톱(macOS) 우선, 로컬 우선.

노트는 내 컴퓨터의 워크스페이스 폴더에 **페이지 하나 = JSON 파일 하나**로 저장해요. 계정·동기화 서버·DB가 없고, Markdown·PDF·zip 백업으로 언제든 꺼낼 수 있어요.

> 이름은 고래자리(Cetus)에서 왔어요. 흩어진 메모(별)를 링크·멘션·백링크로 이으면 생각의 모양(별자리)이 드러난다는 뜻이에요.

## 주요 기능

| 영역      | 내용                                                                                       |
| --------- | ------------------------------------------------------------------------------------------ |
| 편집      | 블록 에디터(Tiptap 3) — 슬래시 메뉴, Markdown 단축 입력, 표, 이미지, 콜아웃, 수식, 할 일   |
| 페이지    | 페이지 트리, 즐겨찾기, 템플릿, 아이콘, 태그, 휴지통, 버전 기록                             |
| 탐색      | ⌘K 명령 팔레트, 초성 검색, @ 멘션, 백링크, 탭, 분할 화면, 목차, 집중 모드                  |
| 컬렉션    | 표·보드·캘린더 보기, 속성(선택·날짜·숫자 등), 레코드 상세                                  |
| 빠른 메모 | ⌘⇧N으로 바로 적기                                                                          |
| 데이터    | 자동 저장(원자적 쓰기), 외부 변경 감지, Markdown 가져오기·내보내기, PDF 내보내기, zip 백업 |

전체 기능 목록과 상태는 [`docs/product/features.md`](docs/product/features.md)에 있어요.

## 기술 스택

- **앱 셸:** [Tauri v2](https://tauri.app) (Rust 백엔드가 파일 입출력을 맡아요)
- **UI:** React 19 · TypeScript · Vite · Tailwind CSS 4 · shadcn/ui · lucide 아이콘 · Motion
- **에디터:** Tiptap 3 (오픈소스 확장만)
- **상태:** Zustand
- **개발 도구:** Storybook 10 · Vitest · ESLint · Prettier

## 시작하기

### 준비물

- Node.js 22 이상, [pnpm](https://pnpm.io)
- Rust (stable) — [Tauri 사전 준비](https://tauri.app/start/prerequisites/) 참고
- macOS (Windows·Linux는 아직 확인하지 않았어요)

### 실행

```bash
pnpm install
pnpm app        # 데스크톱 앱 개발 실행
```

UI만 빠르게 보려면 `pnpm dev`로 브라우저 미리보기(http://localhost:1420)를 띄워요. 이때는 파일 대신 메모리 저장소를 써서, 새로고침하면 내용이 사라져요.

### 명령어

| 명령                              | 내용                                                |
| --------------------------------- | --------------------------------------------------- |
| `pnpm app`                        | 데스크톱 앱 개발 실행                               |
| `pnpm dev`                        | 브라우저 미리보기 (메모리 저장소)                   |
| `pnpm storybook`                  | Storybook (http://localhost:6006)                   |
| `pnpm check`                      | 커밋 전 검사: 타입 검사 + 린트 + 포맷 + 단위 테스트 |
| `pnpm test` / `pnpm test:stories` | 단위 테스트 / 모든 스토리 렌더링 + 접근성 검사      |
| `pnpm test:rust`                  | Rust 저장 계층 테스트                               |
| `pnpm tauri build`                | 릴리스 빌드                                         |

앱 안의 Debug 화면(`#/debug`)에서 모든 컴포넌트 견본과 디자인 토큰을 라이트·다크로 볼 수 있어요.

## 프로젝트 구조

```
src/
  components/   순수 UI 컴포넌트 (L1 UI → L2 오버레이 → L3 셸 → L4 에디터 → L5 페이지 · 컬렉션)
  features/     기능별 상태와 로직 (pages, search, export, backup …)
  screens/      컴포넌트를 조립한 화면 (main, setup)
  lib/storage/  저장소 인터페이스 — Tauri(파일) / 메모리(브라우저 미리보기)
  styles/       디자인 토큰 (tokens.css)
  debug/        Debug 화면
src-tauri/      Rust 백엔드 — 파일 저장, 백업, 버전 기록, 파일 감시, PDF
docs/           기획 · 디자인 · 아키텍처 문서
```

## 문서

| 문서                                                     | 내용                                 |
| -------------------------------------------------------- | ------------------------------------ |
| [`docs/roadmap.md`](docs/roadmap.md)                     | 단계와 진행 상태                     |
| [`docs/product/features.md`](docs/product/features.md)   | 기능 ID, 우선순위, 범위 밖 항목      |
| [`docs/design/components.md`](docs/design/components.md) | 컴포넌트 ID, 계층, 상태              |
| [`docs/design/tokens.md`](docs/design/tokens.md)         | 디자인 토큰 (색, 타이포, 간격, 모션) |
| [`docs/design/concept.md`](docs/design/concept.md)       | 브랜드 컨셉과 이름 표기              |
| [`docs/architecture.md`](docs/architecture.md)           | 폴더 구조, 저장 형식, 결정 기록(ADR) |
| [`docs/dev/debug-screen.md`](docs/dev/debug-screen.md)   | Debug 화면 명세                      |

## 라이선스

[MIT](LICENSE) © 2026 gutanbug

함께 들어 있는 폰트(Pretendard, 나눔명조, JetBrains Mono)는 각자의 SIL Open Font License를 따라요.
