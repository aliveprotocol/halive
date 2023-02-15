# HAlive

HAF-based Alive Protocol streams indexer and API server. Indexes Hive from a starting block number for Alive-related `custom_json` operations using the HAF app sync algorithm.

## Setup

### PostgreSQL Roles
```pgsql
CREATE ROLE halive_app WITH LOGIN PASSWORD 'halivepass' CREATEROLE INHERIT IN ROLE hive_applications_group;
CREATE ROLE halive_user WITH LOGIN INHERIT IN ROLE hive_applications_group;
GRANT CREATE ON DATABASE block_log_testnet TO halive_app;
GRANT halive_user TO halive_app;
```

### PostgREST Installation
```bash
./scripts/postgrest_install.sh
```

## Sync
```bash
npm start
```

## Start PostgREST server
```bash
./scripts/postgrest_start.sh postgres://halive_app:<halive_app_password>@localhost:5432/block_log <server_port>
```