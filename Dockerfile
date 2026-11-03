# syntax=docker/dockerfile:1
# Newbound with Python embedded - the same bundle packaging/bundle.sh builds
# for releases, on a slim Debian.
#
#   docker build -t newbound .
#   docker run -p 8080:8080 -v newbound-data:/newbound/data newbound
#
# Python packages for commands: extend the image -
#   FROM newbound
#   RUN ./venv/bin/pip install <packages>
#
# With the JavaScript runtime (bundle.sh's js variant):
#   docker build --build-arg NEWBOUND_VARIANT=js -t newbound:js .
# Commands that run from esbuild bundles (imports, TypeScript) need their
# bundles current in the build context - run `newbound jsbundle` first.

FROM rust:1.90.0-bookworm AS build
ARG TARGETARCH
ARG NEWBOUND_VARIANT=
WORKDIR /src
COPY . .
RUN case "$TARGETARCH" in \
      amd64) T=x86_64-unknown-linux-gnu ;; \
      arm64) T=aarch64-unknown-linux-gnu ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && packaging/bundle.sh "$T" /dist $NEWBOUND_VARIANT \
 && mv "/dist/newbound-$T${NEWBOUND_VARIANT:+-$NEWBOUND_VARIANT}" /dist/newbound

FROM debian:bookworm-slim
# git: the dev library's repository features use it when present
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /dist/newbound /newbound
WORKDIR /newbound
# The venv next to data/ that the server uses for commands' packages
RUN ./python/bin/python3 -m venv venv
EXPOSE 8080
VOLUME ["/newbound/data"]
CMD ["./newbound"]
