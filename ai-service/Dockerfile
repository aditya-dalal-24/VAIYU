# VAIYU AI service: FastAPI over the trained PyTorch models.
#
# Spring Boot is the only intended caller, so nothing here is published to the
# host by default — see docker-compose.yml.

FROM python:3.11-slim AS runtime
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# curl for the health check; the slim image has neither curl nor wget.
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*

# Torch from the CPU index, before anything else asks for it.
#
# The default PyPI wheel pulls the CUDA runtime: several gigabytes of driver
# libraries that are useless here, because inference is a 64-unit GRU that runs
# in tens of milliseconds on a CPU and the satellite model is a ResNet-18. The
# CPU wheel is around a tenth of the size. Pinned as a floor matching
# requirements.txt, so the pip install below finds these already satisfied and
# does not reach for the CUDA build.
RUN pip install --index-url https://download.pytorch.org/whl/cpu \
    "torch>=2.0.0" "torchvision>=0.15.0"

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# Checkpoints are not in the image. They are large, they are regenerable, and
# they are not in the repository either — so they arrive as a mounted volume.
# With none present the service still starts and reports every analysis as
# NOT_AVAILABLE with a reason, which is the honest behaviour rather than a
# failure to boot.
RUN mkdir -p /app/checkpoints

RUN useradd --system --create-home --shell /usr/sbin/nologin vaiyu \
    && chown -R vaiyu:vaiyu /app
USER vaiyu

EXPOSE 8000
ENV HOST=0.0.0.0 \
    PORT=8000

# Reports which models loaded and why any did not, so an unhealthy container
# is distinguishable from a healthy one serving NOT_AVAILABLE.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
    CMD ["sh", "-c", "curl -fsS http://localhost:8000/api/v1/health || exit 1"]

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
