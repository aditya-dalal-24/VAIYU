# VAIYU Code Conventions

## Frontend Conventions
- **File Naming**: Use PascalCase for React components (e.g., `CycloneMap.tsx`), camelCase for utility functions and hooks (e.g., `useFetchData.ts`).
- **Component Naming**: Component names should match their file names.
- **TypeScript Conventions**: Prefer `interface` over `type` for object shapes. Avoid `any`; use strict typing.
- **Folder Responsibilities**:
  - `routes`: one file per screen; TanStack Start derives the routes from the
    filenames, so there is no `pages` directory.
  - `components/console`: the app shell and the shared primitives every screen
    is built from (`Panel`, `Metric`, `Empty`, `Provenance`).
  - `components/{map,timeline,charts,forecast}`: the feature-specific pieces.
  - `lib/api.ts`: every HTTP call, and the only place the frontend talks to the
    outside. `lib/queries.ts` holds the TanStack Query hooks and cache policy.
- **Absent Data**: render `ABSENT` from `lib/format.ts` (an em dash). Never
  substitute a zero, a blank, a last-known value or an interpolation for a
  measurement that does not exist.
- **Reusable Components**: Keep components pure where possible. Extract complex logic into custom hooks.

## Backend Conventions
- **Architecture**: Controller → Service → Repository.
  - **Controllers**: Handle HTTP requests and responses only.
  - **Services**: Contain business logic.
  - **Repositories**: Handle data access.
- **DTO Usage**: Use DTOs for data transfer between client and server. Never expose internal Entities directly.
- **Entity Responsibilities**: Represents database tables. Should not contain business logic.
- **Naming Conventions**: Use camelCase for variables and methods, PascalCase for classes.
- **Exception Handling**: Use global exception handlers (`@ControllerAdvice`) to return consistent error responses.

## AI Service Conventions
- **API Routes**: Group related endpoints using FastAPI routers.
- **Models**: The registry loads `checkpoints/<key>.pt` at startup; that is
  the only directory it reads. `trained_models/` holds a superseded generation
  of artifacts and is ignored by the service; putting new weights there will
  look like training had no effect.
- **Checkpoints**: a checkpoint carries its own scaler, feature-set version and
  measured metrics, and weights load with `strict=True`. A checkpoint that no
  longer matches its architecture must fail loudly rather than load partially.
- **Preprocessing**: Keep data cleaning and transformation logic in `preprocessing/`.
- **Schemas**: Use Pydantic models for request validation and serialization.
- **Services**: Encapsulate AI inference logic in service classes/functions.

## General
- **Commit Message Conventions**: Use conventional commits (e.g., `feat: added map component`, `fix: corrected login bug`).
- **Branch Workflow**: Use feature branches derived from `main` (e.g., `feature/map-view`, `bugfix/auth-issue`).
- **Pull Request Workflow**: PRs require review before merging. Ensure CI checks pass.
