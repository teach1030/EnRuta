# =============================================================================
# EnRuta Architectural Simulator — Backend Dockerfile (Multi-Stage Production)
# =============================================================================

# --- Etapa 1: Construcción de dependencias en entorno virtual aislado ---
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt


# --- Etapa 2: Runtime ligero y endurecido con usuario sin privilegios ---
FROM python:3.12-slim AS production

LABEL org.opencontainers.image.title="enruta-simulator-backend" \
      org.opencontainers.image.description="FastAPI + Mathematical & TOPSIS Simulation Engine for EnRuta"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

RUN groupadd --system --gid 10001 simuser \
    && useradd --system --uid 10001 --gid simuser --home-dir /app --no-create-home --shell /usr/sbin/nologin simuser \
    && chown -R simuser:simuser /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=simuser:simuser ./app ./app
COPY --chown=simuser:simuser ./tests ./tests

USER simuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health', timeout=3)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
