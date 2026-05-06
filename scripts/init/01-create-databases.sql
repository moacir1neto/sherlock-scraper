-- Bootstrap secondary database used by the whatsmiau-api service.
-- Runs only on a fresh pgdata volume (docker-entrypoint-initdb.d contract).
-- The primary `crm` database is created by Postgres entrypoint via POSTGRES_DB.
SELECT 'CREATE DATABASE whatsmiau OWNER postgres'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'whatsmiau')\gexec
