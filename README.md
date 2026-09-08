# CycloVision

## Project Overview
CycloVision is an AI/ML Based Tropical Cyclone Identification, Classification, Tracking and Prediction Platform. It provides early warning intelligence by analyzing multi-source satellite data.

## Problem Statement
Tropical cyclones cause massive devastation. Early and accurate identification, classification, and trajectory prediction using modern AI and multi-source satellite data can significantly improve early warning systems and save lives.

## Architecture
CycloVision follows a modular monolith architecture with a separate AI/ML service:
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui -> Vercel
- **Backend**: Java, Spring Boot, REST APIs -> Render
- **AI Service**: Python, FastAPI -> Render
- **Database**: Neon PostgreSQL, PostGIS

## Repository Structure
- `/frontend`: React frontend application
- `/backend`: Spring Boot central API
- `/ai-service`: FastAPI service for AI/ML tasks
- `/shared`: Shared API contracts, schemas, and constants
- `/docs`: Project documentation
- `/scripts`: Setup and automation scripts
- `/.github`: GitHub actions and workflows

## Team Development Workflow
Please review our development guidelines before contributing:
- [Code Conventions](docs/development/code-conventions.md)
- [Module Ownership](docs/development/module-ownership.md)
- [System Architecture](docs/architecture/system-architecture.md)

## How to Run

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
mvn spring-boot:run
```

### AI Service
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Current Development Status
**Project foundation and repository structure are initialized. Feature development has not started yet.**
