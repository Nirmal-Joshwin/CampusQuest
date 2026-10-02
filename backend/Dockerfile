# ==============================================================================
# CampusQuest Production Dockerfile (FastAPI + Python 3.12)
# ==============================================================================
FROM python:3.12-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ==============================================================================
# Final Production Runtime Image
# ==============================================================================
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/campusquest/.local/bin:$PATH \
    PORT=8000 \
    HOST=0.0.0.0 \
    ENVIRONMENT=production

# Install minimal runtime libraries for PostgreSQL / PostGIS clients
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create secure non-root user
RUN groupadd -g 10001 campusquest && \
    useradd -u 10001 -g campusquest -m -s /bin/bash campusquest

# Copy installed Python packages from builder
COPY --from=builder /root/.local /home/campusquest/.local

# Copy application codebase
COPY --chown=campusquest:campusquest . /app

USER campusquest

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers"]
