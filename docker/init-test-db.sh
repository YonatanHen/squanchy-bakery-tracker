#!/bin/sh
# Creates the test database next to the app database on the first start.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE DATABASE \"$POSTGRES_TEST_DB\" OWNER \"$POSTGRES_USER\";"
