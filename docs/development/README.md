# CycloVision Development Guide

## Environment Configuration
To run the backend locally, you must configure your environment variables. 
**IMPORTANT**: Spring Boot does **NOT** automatically load `.env` files. `.env.example` is purely a documentation/template file.

### A. The `.env.example` Template
1. Copy `backend/.env.example` to a new file named `backend/.env` (which is git-ignored).
2. Provide the required Neon PostgreSQL credentials inside your new `.env` file:
   - `DB_URL`: The JDBC URL for the Neon database (e.g., `jdbc:postgresql://<host>.neon.tech/cyclovision?sslmode=require`)
   - `DB_USERNAME`: Your Neon username
   - `DB_PASSWORD`: Your Neon password

*Note: Never commit your `.env` file to version control.*

### B. Command Line Execution
When running from the command line, you must explicitly load these variables into your session before starting Spring Boot.

**On Windows (PowerShell):**
```powershell
Get-Content .env | Where-Object { $_ -match '=' -and -not $_.StartsWith('#') } | ForEach-Object {
    $parts = $_.Split('=', 2)
    [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim())
}
mvn spring-boot:run
```

**On Linux/Mac:**
```bash
export $(grep -v '^#' .env | xargs) && mvn spring-boot:run
```

### C. IDE Configuration (IntelliJ / VS Code)
If you run the application via your IDE (e.g., clicking the "Play" button on `BackendApplication.java`), the `.env` file will **NOT** be read. 
You must manually add the environment variables to your IDE's Run/Debug Configuration:
- **IntelliJ**: Edit Configuration -> Environment Variables -> Paste the variables.
- **VS Code**: Add an `env` block to your `launch.json`.

## Database Migrations (Flyway)
We use Flyway as the database schema migration authority. 
- `ddl-auto` is set to `validate`. Hibernate will NOT auto-create or update tables.
- All schema changes must be written as SQL scripts in `backend/src/main/resources/db/migration/`.
- Naming convention: `V<version>__<description>.sql` (e.g., `V1__init.sql`).
- Migrations run automatically when the Spring Boot application starts.

## Running the Backend
Ensure your `.env` is configured, then run:
```bash
cd backend
mvn clean spring-boot:run
```

## Testing the Health Endpoint
We use Spring Boot Actuator to monitor application health.
Once the backend is running, verify the health by accessing:
```
GET http://localhost:8080/actuator/health
```
Expected response:
```json
{"status":"UP"}
```
