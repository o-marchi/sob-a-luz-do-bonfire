# Railway Project

Treat these as discovery hints and verify them live because names and IDs may drift.

| Resource | Value |
| --- | --- |
| Project | `playground` |
| Project ID | `89d0830b-b82a-41bb-a5ae-33db8e3c4056` |
| Environment | `production` |
| Environment ID | `47ce57d4-94b9-456f-9ca2-0392f82d966d` |
| API service | `helpful-youth` |
| API service ID | `495a6592-500a-4bdc-9e36-5be05ee9ef57` |
| Public API | `https://helpful-youth-production-e9d1.up.railway.app` |
| Database service | `Postgres-rVdn` |
| Deploy branch | `master` |

## Build layout

- Railway root directory: `server`
- Railway config: `server/railway.json`
- Dockerfile: `server/Dockerfile`, addressed as `Dockerfile` from the Railway root
- Runtime entrypoint: `node dist/main.js`
- Runtime Node environment must be `production`

The Docker build context is `server`, so files outside that directory cannot be copied by its Dockerfile.

## Diagnostic readback

A healthy deployment requires all of the following:

1. The latest deployment commit matches `origin/master`.
2. Build status succeeded and an image digest exists.
3. API service has at least one running replica and zero crashed replicas.
4. PostgreSQL service is healthy.
5. `GET /campaign/current` or `/docs-json` succeeds on the public domain.
