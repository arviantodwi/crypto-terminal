# apps/postgres

Podman-managed PostgreSQL container for the crypto-terminal monorepo.

## Setup

```bash
# 1. Create your local credentials file (never committed)
cp .env.example .env

# 2. Edit .env — at minimum change POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB
```

## Usage

Run these from the **repo root**:

| Command           | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `pnpm pg:up`      | Start the container in the background                         |
| `pnpm pg:stop`    | Stop the container (data preserved)                           |
| `pnpm pg:down`    | Remove the container (data volume preserved)                  |
| `pnpm pg:logs`    | Tail container logs                                           |
| `pnpm pg:destroy` | Permanently delete the data volume (prompts for confirmation) |

## Connecting

```
postgres://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:<POSTGRES_PORT>/<POSTGRES_DB>
```

For example:

```
postgres://your_username:your_password@localhost:5432/your_db_name
```

Set this as the `DATABASE_URL` in the `.env` file of every app that connects to Postgres.

## Data persistence

Data is stored in the named podman volume `crypto-terminal-postgres-data`. It survives `pg:down`. To permanently delete it, run `pnpm pg:destroy` — it will prompt for confirmation before proceeding.

## initdb

The `initdb/` directory is mounted into `/docker-entrypoint-initdb.d/` inside the container. SQL or shell scripts placed here run **once**, on first-time volume initialization. The directory is kept empty by default — add scripts here if you need custom initialization (roles, extensions, seed data).
