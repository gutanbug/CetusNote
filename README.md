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
- 지원 OS: macOS(universal, Apple Silicon·Intel), Windows 10·11(x64), Linux(x64, Ubuntu 22.04 이상 등 WebKitGTK 4.1을 쓰는 배포판)
- Linux 개발 빌드에 필요한 패키지(Ubuntu/Debian): `sudo apt install build-essential curl file pkg-config libssl-dev libxdo-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`
- Windows 개발 빌드: Visual Studio Build Tools(C++ 데스크톱 워크로드)와 WebView2 런타임(Windows 11은 기본 설치)

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

## 설치 · 업데이트 · 릴리스

### 설치 (macOS)

- [릴리스 페이지](https://github.com/gutanbug/CetusNote/releases)에서 최신 `.dmg`를 받아요.
- 서명과 공증을 아직 하지 않아서, 처음 실행하면 macOS가 막을 수 있어요. 앱을 우클릭 › 열기로 열어 주세요(또는 시스템 설정 › 개인정보 보호 및 보안에서 허용).

### 설치 (Windows)

- 릴리스 페이지에서 `…-setup.exe`(NSIS 설치 파일)를 받아 실행해요. 현재 사용자 폴더에 설치돼요.
- 코드 서명을 아직 하지 않아서 **Windows SmartScreen이 "Windows의 PC 보호"를 띄울 수 있어요.** 「추가 정보」를 누르고 「실행」을 누르면 설치돼요.

### 설치 (Linux)

- **AppImage**: 내려받은 파일에 실행 권한을 주고(`chmod +x Cetus.Note_*.AppImage`) 실행해요. Ubuntu 22.04 이상에서는 `libfuse2`가 필요할 수 있어요(`sudo apt install libfuse2`).
- **deb**: `sudo apt install ./Cetus.Note_*_amd64.deb`로 설치해요. deb 설치본은 앱 안에서 업데이트하지 않으니 새 파일을 받아 다시 설치해요.
- 「…에서 보기」 메뉴는 그 OS의 기본 파일 관리자를 열어요(macOS Finder · Windows 탐색기 · Linux 파일 관리자).

### 업데이트

- 앱을 켤 때와 켜 둔 동안 하루에 한 번 새 버전이 있는지 확인해요. 새 버전이 나오면 토스트로 알려 드려요.
- 설치는 **업데이트를 누를 때만** 해요. 내려받은 뒤 편집 중인 내용을 모두 저장하고 앱을 다시 열어요.
- 설정 › 일반 › 업데이트에서 현재 버전을 보고 "업데이트 확인"을 누를 수 있어요. ⌘K에서 "업데이트 확인"도 돼요. "자동으로 업데이트 확인"을 끄면 자동 확인을 멈춰요.

### 릴리스 (메인테이너)

0. Windows·Linux가 빌드되는지는 `.github/workflows/ci.yml`(PR·수동 실행, 릴리스 없음)이 먼저 알려 줘요. macOS는 개발 Mac에서 직접 확인해요. 실제 Windows·Linux 설치는 릴리스 뒤에 직접 확인해요.
1. 버전 맞추기: `node scripts/version.mjs 0.2.0` — package.json · Cargo.toml · tauri.conf.json · Cargo.lock을 함께 바꿔요. 이어서 `cd src-tauri && cargo check`로 Cargo.lock을 확인해요.
2. 커밋한 뒤 `v` 태그를 올려요(예: `git tag v0.2.0`, `git push origin v0.2.0`). 워크플로(`.github/workflows/release.yml`)가 macOS universal(`.dmg`·`.app.tar.gz`), Windows(`-setup.exe`), Linux(`.AppImage`·`.deb`)를 빌드해 GitHub Release에 올리고, 각 업데이트 파일의 `.sig`를 모아 `latest.json` 하나를 만들어요(`scripts/make-latest-json.mjs`, 세 플랫폼이 모두 있어야 성공). 태그와 버전 파일이 다르면 빌드 전에 멈춰요.
3. 저장소 시크릿이 필요해요(한 번만): `gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/cetusnote.key`, 그리고 `gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --body ""`(키에 비밀번호를 걸지 않았으면 빈 값).
4. **업데이트 서명 키(`~/.tauri/cetusnote.key`)를 잃으면 이미 설치된 앱이 더는 업데이트를 받을 수 없어요.** 비밀번호 관리 도구 같은 안전한 곳에 백업해 두세요. 저장소에는 올라가지 않아요(`*.key` 무시). 공개 키는 `src-tauri/tauri.conf.json`의 `plugins.updater.pubkey`에 있어요.
5. 로컬에서 릴리스 빌드만 해 볼 때는 `pnpm tauri build`를 써요. 업데이트 파일은 만들지 않아서 서명 키가 없어도 돼요.

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
