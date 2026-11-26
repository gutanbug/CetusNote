# CetusNote 로컬 릴리스: Windows x86_64 (NSIS 설치 파일) 교차 빌드 툴체인.
# Linux 컨테이너에서 cargo-xwin(MSVC 대상 교차 컴파일)과 NSIS로 만든다. 호스트 아키텍처(arm64)에서 그대로 돈다.
# 소스와 서명 키는 이미지에 넣지 않고 실행할 때 마운트한다.
# 빌드: docker build -f docker/release-windows.Dockerfile -t cetusnote-release-windows docker/
# 실행은 scripts/release-local.sh가 한다.
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    PATH=/root/.cargo/bin:/usr/local/bin:/usr/bin:/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl wget file git xz-utils unzip build-essential pkg-config \
        clang lld llvm nsis \
    && rm -rf /var/lib/apt/lists/*

# Ubuntu의 NSIS 3.08에는 Tauri 템플릿이 쓰는 Include/Win/RestartManager.nsh가 없다. Tauri가 받는 NSIS 3.11의 Include에서 없는 파일만 채운다
RUN curl -fsSL -o /tmp/nsis.zip https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip \
    && unzip -q /tmp/nsis.zip -d /tmp/nsis-src \
    && cp -rn "$(find /tmp/nsis-src -type d -name Include | head -1)/." /usr/share/nsis/Include/ \
    && rm -rf /tmp/nsis.zip /tmp/nsis-src \
    && test -f /usr/share/nsis/Include/Win/RestartManager.nsh

# cargo-xwin은 clang-cl · lld-link · llvm-lib 이름을 찾는다. Ubuntu 패키지의 버전 붙은 이름을 연결한다
RUN ln -sf "$(ls /usr/bin/clang-[0-9]* | sort -V | tail -1)" /usr/local/bin/clang-cl \
    && ln -sf "$(ls /usr/bin/lld-link-[0-9]* | sort -V | tail -1)" /usr/local/bin/lld-link \
    && ln -sf "$(ls /usr/bin/llvm-lib-[0-9]* | sort -V | tail -1)" /usr/local/bin/llvm-lib \
    && ln -sf "$(ls /usr/bin/llvm-ar-[0-9]* | sort -V | tail -1)" /usr/local/bin/llvm-ar

# Node 22 · pnpm 10.6.1 (CI와 같은 버전)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@10.6.1

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable \
    && rustup target add x86_64-pc-windows-msvc \
    && cargo install --locked cargo-xwin

WORKDIR /work
