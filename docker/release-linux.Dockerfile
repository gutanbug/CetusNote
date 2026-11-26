# CetusNote 로컬 릴리스: Linux x86_64 (AppImage · deb) 빌드 툴체인.
# CI(release.yml의 ubuntu-22.04 작업)와 같은 베이스·시스템 패키지를 쓴다. 소스와 서명 키는 이미지에 넣지 않고 실행할 때 마운트한다.
# 빌드: docker build --platform linux/amd64 -f docker/release-linux.Dockerfile -t cetusnote-release-linux docker/
# 실행은 scripts/release-local.sh가 한다.
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    # linuxdeploy(AppImage 도구)를 FUSE 없이 실행한다. 컨테이너에는 FUSE가 없다
    APPIMAGE_EXTRACT_AND_RUN=1 \
    PATH=/root/.cargo/bin:/usr/local/bin:/usr/bin:/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl wget file git xz-utils unzip squashfs-tools \
        build-essential pkg-config libssl-dev libxdo-dev \
        libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf \
    && rm -rf /var/lib/apt/lists/*

# Node 22 (CI와 같은 주 버전) · pnpm 10.6.1 (CI의 pnpm/action-setup 버전과 같다)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@10.6.1

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable \
    && rustup target add x86_64-unknown-linux-gnu

# sbin이 PATH에 없으면 linuxdeploy-plugin-gtk가 명령을 못 찾아(종료 127) AppImage 단계에서 실패한다.
# 맨 뒤에 둬서 앞 단계의 Docker 캐시를 깨지 않는다.
ENV PATH=/root/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

WORKDIR /work
