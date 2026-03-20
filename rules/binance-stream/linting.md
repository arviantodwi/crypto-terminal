---
paths:
  - "apps/binance-stream/**"
---

# Linting & Formatting (Ruff)

Config lives in `apps/binance-stream/pyproject.toml`.

| Setting | Value |
|---------|-------|
| Line length | 100 characters |
| Rules | `E` (pycodestyle errors), `F` (pyflakes), `I` (isort) |
| Target | Python 3.12 |

## Commands

```bash
poetry run ruff check .    # Lint
poetry run ruff format .   # Format
```
