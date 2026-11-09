FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build && test -f dist/index.html

FROM golang:1.26.5-bookworm AS backend
WORKDIR /build/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /out/firemex .

FROM ghcr.io/home-assistant/base-debian:bookworm AS runtime

WORKDIR /opt/firemex

COPY --from=frontend /build/frontend/dist ./ui/
COPY --from=backend /out/firemex ./firemex

RUN test -f ui/index.html && test -x firemex

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-common \
    && printf '\ncreate_main_cluster = false\n' >> /etc/postgresql-common/createcluster.conf \
    && apt-get install -y --no-install-recommends \
        postgresql-15 \
        python3 \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python3 --version && /usr/lib/postgresql/15/bin/postgres --version

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY firemex-model/requirements.txt ./model/requirements.txt

RUN python3 -m venv /opt/firemex/venv \
    && /opt/firemex/venv/bin/python -m pip install --no-cache-dir \
        -r /opt/firemex/model/requirements.txt

COPY firemex-model/detect_service.py firemex-model/annotate.py firemex-model/fire_model.pt ./model/

RUN cd /opt/firemex/model \
    && /opt/firemex/venv/bin/python -c "import detect_service; print('FireMeX inference service imported successfully')"

RUN cd /opt/firemex/model && /opt/firemex/venv/bin/python - <<'PY'
import asyncio
from detect_service import app

async def check():
    async with app.router.lifespan_context(app):
        print("FireMeX model loaded and warmed up successfully")

asyncio.run(check())
PY

RUN useradd --system --user-group --no-create-home --shell /usr/sbin/nologin firemex-model

RUN useradd --system --user-group --no-create-home --shell /usr/sbin/nologin firemex

COPY deploy/homeassistant/rootfs/ /

ARG BUILD_VERSION=0.1.0
ARG BUILD_ARCH=aarch64
LABEL io.hass.name="FireMeX" \
    io.hass.type="app" \
    io.hass.version="${BUILD_VERSION}" \
    io.hass.arch="${BUILD_ARCH}"
