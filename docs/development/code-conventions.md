# CycloVision Code Conventions

## Frontend Conventions
- **File Naming**: Use PascalCase for React components (e.g., `CycloneMap.tsx`), camelCase for utility functions and hooks (e.g., `useFetchData.ts`).
- **Component Naming**: Component names should match their file names.
- **TypeScript Conventions**: Prefer `interface` over `type` for object shapes. Avoid `any`; use strict typing.
- **Folder Responsibilities**: 
  - `components/ui`: Reusable dumb components (e.g., buttons, inputs).
  - `components/layout`: Structural components (e.g., header, sidebar).
  - `pages`: High-level views mapped to routes.
  - `services`: API call logic.
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
- **Models**: Store machine learning model weights in `trained_models/`.
- **Preprocessing**: Keep data cleaning and transformation logic in `preprocessing/`.
- **Schemas**: Use Pydantic models for request validation and serialization.
- **Services**: Encapsulate AI inference logic in service classes/functions.

## General
- **Commit Message Conventions**: Use conventional commits (e.g., `feat: added map component`, `fix: corrected login bug`).
- **Branch Workflow**: Use feature branches derived from `main` (e.g., `feature/map-view`, `bugfix/auth-issue`).
- **Pull Request Workflow**: PRs require review before merging. Ensure CI checks pass.
