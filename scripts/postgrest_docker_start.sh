#!/bin/bash
POSTGRES_URI=$1
PORT=$2

docker run -d --rm --network host \
    -e PGRST_DB_URI=$POSTGRES_URI \
    -e PGRST_DB_SCHEMA=halive_api \
    -e PGRST_DB_ANON_ROLE=halive_user \
    -e PGRST_DB_ROOT_SPEC=home \
    -e PGRST_SERVER_PORT=$PORT \
    --name halive-pgserver \
    postgrest/postgrest