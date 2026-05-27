FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip

COPY requirements.txt .

RUN pip install --no-cache-dir --default-timeout=500 \
    --find-links https://download.pytorch.org/whl/cpu/torch_stable.html \
    -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]