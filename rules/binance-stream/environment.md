---
paths:
  - "apps/binance-stream/**"
---

# Binance Stream Environment

## Python Version

Python 3.12 managed via `pyenv`. Version pinned in `apps/binance-stream/.python-version`.

## Dependency Management

Dependencies managed via Poetry (`pyproject.toml`). Virtual environment is auto-created by Poetry.

```bash
poetry install   # Install all dependencies
```

## Environment Variables

Copy `.env.example` to `.env` and fill in required values (Binance API keys, database config, etc.).
