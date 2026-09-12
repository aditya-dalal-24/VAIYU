# VAIYU Development Guide

## Environment Configuration

Copy `backend/.env.example` to `backend/.env` (which is git-ignored) and fill in
your local values:

- `SERVER_PORT` — the backend's port. `8081` is the documented default, because
  8080 is so often already taken by something else.
- `DB_URL` — e.g. `jdbc:postgresql://localhost:5432/vaiyu`
- `DB_USERNAME`, `DB_PASSWORD` — your local PostgreSQL credentials
- `AI_SERVICE_URL` — e.g. `http://localhost:8000`
- `PUBLIC_BASE_URL` — where the backend is reachable **from the AI service**,
  because uploaded satellite frames are fetched by URL rather than passed
  inline.

Spring Boot does not read `.env` files on its own, so `BackendApplication.main`
loads one before the context starts, from `./.env`, `backend/.env` or
`../backend/.env`, whichever it finds first. That means the file works the same
way from Maven, from a jar and from an IDE's run button — there is no export
step and nothing to duplicate into a Run/Debug configuration.

A value already present as a real environment variable or system property is
never overwritten, so a deployment that sets configuration properly is
unaffected by the file.

`application.yml` also carries defaults for everything except the password, so
the backend will start against a local `vaiyu` database without a `.env` at all.
It will not authenticate unless your PostgreSQL accepts the placeholder, which
is the point: the credential is the one thing that must be supplied.

*Never commit your `.env`.*

## Database Migrations (Flyway)

Flyway is the schema authority.

- `ddl-auto` is `validate`: Hibernate will not create or alter tables, only
  check that the entity mappings match what the migrations produced. With
  `update` the two fought each other and silently created tables no migration
  knew about.
- All schema changes are SQL scripts in
  `backend/src/main/resources/db/migration/`.
- Naming: `V<version>__<description>.sql`, e.g. `V1__init.sql`.
- Migrations run automatically at startup.

## Running the Backend

```bash
cd backend
mvn spring-boot:run
```

Use `mvn clean spring-boot:run` if configuration changes seem to have no
effect: a stale `target/classes/application.properties` from an earlier build
once overrode the YAML entirely, forcing the wrong database and port.

## Health

```text
GET http://localhost:8081/actuator/health   → {"status":"UP"}
GET http://localhost:8081/api/v1/system/status
```

The second is the more useful one while developing: it reports which models the
AI service has loaded, how many storms and fixes are stored, and the reason for
anything that is unavailable.

## Loading the Archive

```bash
curl -X POST http://localhost:8081/api/internal/ingest/ibtracs
```

Reads `ai-service/data/processed/observations.csv`, which the AI service's
training pipeline produces, so inference input matches training data by
construction. Upserts key on `(external_source, external_id)`, so re-running
after a retrain is safe.
