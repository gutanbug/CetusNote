#!/usr/bin/env bash
# 로컬 릴리스 (CI 대신): macOS는 이 Mac에서, Linux·Windows는 Docker에서 빌드하고 GitHub Release를 만든다.
# 사용: scripts/release-local.sh v0.1.6 [--publish] [--build-only] [--skip-mac] [--skip-linux] [--skip-windows] [--out DIR]
#
# 흐름: 태그 소스를 git archive로 꺼낸다 → 세 플랫폼 빌드·서명 → 파일 이름 점 표기(GitHub 규칙) →
#       make-latest-json.mjs로 latest.json → Release를 draft로 만들고 목록 확인 → --publish면 공개.
# 서명 키(~/.tauri/cetusnote.key)는 환경 변수나 읽기 전용 마운트로만 넘기고 출력하지 않는다.
# 세 플랫폼 중 하나라도 실패하면 Release를 만들지 않는다(불완전한 latest.json이 올라가지 않게).
#
# ⚠ .github/workflows/release.yml과 짝이다. 한쪽을 고치면 다른 쪽도 고친다. 맞춰야 하는 것:
#   - 산출물 이름·종류(.dmg · .app.tar.gz · -setup.exe · .AppImage · .deb · .sig)와 latest.json 만드는 방법(make-latest-json.mjs)
#   - 빌드 인자: macOS `--target universal-apple-darwin --config src-tauri/tauri.release.conf.json`, Windows·Linux `--config src-tauri/tauri.release.conf.json`
#   - 릴리스 본문: `scripts/release-notes.mjs <tag> --with-footer` (설치 안내 꼬리말은 release-notes.mjs에만 있다)
#   - 차이로 남는 것: 이 스크립트는 draft 후 --publish로 공개, 워크플로는 바로 공개
set -euo pipefail

REPO="${REPO:-gutanbug/CetusNote}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY="${TAURI_KEY_FILE:-$HOME/.tauri/cetusnote.key}"
PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

die() { echo "release-local: $*" >&2; exit 1; }
log() { echo "== $*"; }

TAG="${1:-}"
[[ -n "$TAG" ]] || die "태그가 필요해요. 예: scripts/release-local.sh v0.1.6"
shift
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "태그 형식이 아니에요: $TAG"

CACHE="${RELEASE_CACHE:-$HOME/.cache/cetusnote-release}"
PUBLISH=0; BUILD_ONLY=0; SKIP_MAC=0; SKIP_LINUX=0; SKIP_WIN=0; OUT="$CACHE/$TAG"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish) PUBLISH=1 ;;
    --build-only) BUILD_ONLY=1 ;;
    --skip-mac) SKIP_MAC=1 ;;
    --skip-linux) SKIP_LINUX=1 ;;
    --skip-windows) SKIP_WIN=1 ;;
    --out) OUT="$2"; shift ;;
    *) die "알 수 없는 옵션: $1" ;;
  esac
  shift
done

# --- 사전 확인 ---------------------------------------------------------------
cd "$ROOT"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || die "태그가 없어요: $TAG"
[[ -r "$KEY" ]] || die "서명 키를 읽을 수 없어요: $KEY"
node scripts/version.mjs --check "$TAG" >/dev/null || die "태그와 버전 파일이 달라요"
command -v gh >/dev/null || die "gh가 필요해요"
command -v docker >/dev/null || die "docker가 필요해요"
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  die "이미 Release가 있어요: $TAG (먼저 확인하거나 삭제하세요)"
fi

mkdir -p "$OUT"/{src-mac,src-docker,mac,linux,windows,assets}
log "태그 소스 꺼내기: $TAG → $OUT"
for d in src-mac src-docker; do
  rm -rf "$OUT/$d"; mkdir -p "$OUT/$d"
  git archive "$TAG" | tar -x -C "$OUT/$d"
done

# 서명 키는 환경 변수로만 넘긴다(출력하지 않는다)
sign_env() {
  TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$PASSWORD" "$@"
}

# --- macOS (이 Mac, universal) ----------------------------------------------
build_mac() {
  log "macOS universal 빌드"
  cd "$OUT/src-mac"
  pnpm install --frozen-lockfile
  CARGO_TARGET_DIR="$CACHE/target-mac" \
    sign_env pnpm tauri build --target universal-apple-darwin --config src-tauri/tauri.release.conf.json
  local b="$CACHE/target-mac/universal-apple-darwin/release/bundle"
  cp "$b"/dmg/*.dmg "$OUT/mac/"
  # 업데이트 묶음은 버전 없는 이름으로 나오므로, CI(tauri-action)가 올린 이름(Cetus Note_<버전>_universal.app.tar.gz)에 맞춘다
  local name="Cetus Note_${TAG#v}_universal.app.tar.gz"
  cp "$b/macos/Cetus Note.app.tar.gz" "$OUT/mac/$name"
  cp "$b/macos/Cetus Note.app.tar.gz.sig" "$OUT/mac/$name.sig"
  cd "$ROOT"
}

# --- Linux (Docker amd64, ubuntu 22.04) ------------------------------------
# Tauri 번들러(AppImage)가 쓰는 도구를 미리 받아 둔다. 파일 이름과 캐시 위치는 tauri-bundler(tauri-cli-v2.12.6)의
# linuxdeploy.rs와 같아야 한다. 있으면 Tauri는 다시 받지 않는다. 받은 파일은 SHA-256으로 확인한다.
# - linuxdeploy: Tauri가 실행 전에 magic(8~10바이트)을 지운다 → 에뮬레이션에서도 실행된다.
# - linuxdeploy-plugin-appimage: Tauri가 지우지 않는다 → 컨테이너 안에서 지운다(run 명령 참고).
fetch_linux_tool() { # <파일 이름> <URL> <SHA-256>
  local path="$CACHE/linux-tools/$1"
  if [[ "$(shasum -a 256 "$path" 2>/dev/null | cut -d' ' -f1)" != "$3" ]]; then
    log "빌드 도구 내려받기: $1"
    curl -fsSL -o "$path.part" "$2"
    mv "$path.part" "$path"
    [[ "$(shasum -a 256 "$path" | cut -d' ' -f1)" == "$3" ]] || die "빌드 도구 해시가 달라요: $1"
  fi
}

prepare_linux_tools() {
  local base="https://github.com/tauri-apps/binary-releases/releases/download"
  mkdir -p "$CACHE/linux-tools"
  fetch_linux_tool linuxdeploy-07333c6-x86_64.AppImage "$base/linuxdeploy-07333c6/linuxdeploy-x86_64.AppImage" \
    36a2d7e274d12e1050d0e9ecfe11d339ed54720b2bec464c286d53f8b07f5c62
  fetch_linux_tool AppRun-x86_64 "$base/apprun-old/AppRun-x86_64" \
    f30140a43a0a59e46db21bdefdf749b9e9f2c6946e92afabbacf98b8ae73fb4f
  fetch_linux_tool linuxdeploy-plugin-appimage.AppImage \
    "https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/continuous/linuxdeploy-plugin-appimage-x86_64.AppImage" \
    49d6a17160675a6bd1781699aae6bdf7692d98552e02a3671d2183d10547842e
}

build_linux() {
  log "Linux x86_64 빌드 (Docker, 에뮬레이션)"
  prepare_linux_tools
  docker build --platform linux/amd64 -f docker/release-linux.Dockerfile \
    -t cetusnote-release-linux docker/
  docker run --rm --platform linux/amd64 \
    -v "$OUT/src-docker:/src:ro" \
    -v "$KEY:/run/secrets/tauri.key:ro" \
    -v "$CACHE/linux-tools:/tools:ro" \
    -e TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$PASSWORD" \
    -e CARGO_TARGET_DIR=/cache/target-linux \
    -v cetusnote-cargo-registry:/root/.cargo/registry \
    -v cetusnote-linux-target:/cache/target-linux \
    -v cetusnote-pnpm-store:/cache/pnpm-store \
    -v "$OUT/linux:/out" \
    cetusnote-release-linux bash -c '
      set -euo pipefail
      # Tauri 캐시(~/.cache/tauri)에 도구를 넣는다. 플러그인은 에뮬레이션이 실행하지 못하는 AppImage 표식(8~10바이트)을 지운다
      # 마운트된 파일에는 실행 권한이 없다. Tauri는 캐시에 파일이 있으면 내려받지도 chmod하지도 않으므로 여기서 준다
      mkdir -p /root/.cache/tauri && cp /tools/* /root/.cache/tauri/ && chmod +x /root/.cache/tauri/*
      printf "\0\0\0" | dd of=/root/.cache/tauri/linuxdeploy-plugin-appimage.AppImage bs=1 seek=8 conv=notrunc 2>/dev/null
      cp -a /src/. /work/ && cd /work
      pnpm config set store-dir /cache/pnpm-store
      pnpm install --frozen-lockfile
      export TAURI_SIGNING_PRIVATE_KEY="$(cat /run/secrets/tauri.key)"
      pnpm tauri build --config src-tauri/tauri.release.conf.json
      b=/cache/target-linux/release/bundle
      cp -a "$b"/appimage/*.AppImage "$b"/appimage/*.AppImage.sig "$b"/deb/*.deb "$b"/deb/*.deb.sig /out/
    '
}

# --- Windows (Docker, cargo-xwin 교차 컴파일 + NSIS) ----------------------
build_windows() {
  log "Windows x86_64 NSIS 빌드 (Docker, cargo-xwin)"
  docker build -f docker/release-windows.Dockerfile -t cetusnote-release-windows docker/
  docker run --rm \
    -v "$OUT/src-docker:/src:ro" \
    -v "$KEY:/run/secrets/tauri.key:ro" \
    -e TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$PASSWORD" \
    -e CARGO_TARGET_DIR=/cache/target-windows \
    -e XWIN_ACCEPT_LICENSE=1 \
    -v cetusnote-cargo-registry:/root/.cargo/registry \
    -v cetusnote-windows-target:/cache/target-windows \
    -v cetusnote-pnpm-store:/cache/pnpm-store \
    -v "$OUT/windows:/out" \
    cetusnote-release-windows bash -c '
      set -euo pipefail
      cp -a /src/. /work/ && cd /work
      pnpm config set store-dir /cache/pnpm-store
      pnpm install --frozen-lockfile
      export TAURI_SIGNING_PRIVATE_KEY="$(cat /run/secrets/tauri.key)"
      pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis \
        --config src-tauri/tauri.release.conf.json
      b=/cache/target-windows/x86_64-pc-windows-msvc/release/bundle/nsis
      cp -a "$b"/*-setup.exe "$b"/*-setup.exe.sig /out/
    '
}

[[ $SKIP_MAC -eq 1 ]] || build_mac
[[ $SKIP_LINUX -eq 1 ]] || build_linux
[[ $SKIP_WIN -eq 1 ]] || build_windows
[[ $BUILD_ONLY -eq 0 ]] || { log "빌드만 했어요 (--build-only): $OUT"; exit 0; }

# --- 자산 모으기 (공백 → 점: GitHub이 올릴 때 바꾸는 이름과 맞춘다) ------------
log "자산 이름 정리"
rm -f "$OUT/assets"/*
for f in "$OUT"/mac/* "$OUT"/linux/* "$OUT"/windows/*; do
  [[ -f "$f" ]] || continue
  cp "$f" "$OUT/assets/$(basename "$f" | tr ' ' '.')"
done
ls "$OUT/assets" | sed 's/^/  /'

# --- latest.json ------------------------------------------------------------
log "latest.json 만들기"
node scripts/make-latest-json.mjs --tag "$TAG" --dir "$OUT/assets" --repo "$REPO" --out "$OUT/assets/latest.json"

# --- Release (draft → 확인 → 공개) ------------------------------------------
node scripts/release-notes.mjs "$TAG" --with-footer > "$OUT/release-notes.md"

log "Release draft 만들기: $TAG"
gh release create "$TAG" --repo "$REPO" --draft --title "Cetus Note $TAG" \
  --notes-file "$OUT/release-notes.md" "$OUT"/assets/*
gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[] | "\(.name)\t\(.size)"'

if [[ $PUBLISH -eq 1 ]]; then
  gh release edit "$TAG" --repo "$REPO" --draft=false --latest
  log "공개했어요: https://github.com/$REPO/releases/tag/$TAG"
else
  log "draft로 두었어요. 확인 후 공개: gh release edit $TAG --repo $REPO --draft=false --latest"
fi
