# Database Migration Guide: SQLite to PostgreSQL

This guide documents the process for migrating the ISMS application from SQLite to PostgreSQL.

## Overview

The migration process involves:
1. Setting up a temporary PostgreSQL instance
2. Running Prisma migrations to create the schema
3. Migrating data from SQLite to PostgreSQL using external tools
4. Exporting seed data from the migrated database
5. Updating all environments to use PostgreSQL
6. Validating the migration

## Prerequisites

- Docker and Docker Compose installed
- Access to the existing SQLite database file
- PostgreSQL client tools (optional, for verification)
- External migration tool: [pgloader](https://github.com/dimitri/pgloader) or [Sequel](https://github.com/sequelize/sequelize) (recommended: pgloader)

## Step 1: Set Up Temporary PostgreSQL Instance

Create a temporary Docker Compose file to spin up a PostgreSQL instance for migration:

```yaml
# docker-compose.migration.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: isms_db
    ports:
      - "5433:5432"  # Use different port to avoid conflicts
    volumes:
      - postgres_migration_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_migration_data:
```

Start the temporary PostgreSQL instance:

```bash
docker compose -f docker-compose.migration.yml up -d
```

Wait for the database to be ready (check health status):

```bash
docker compose -f docker-compose.migration.yml ps
```

## Step 2: Run Prisma Migrations

Before migrating data, you need to create the database schema in PostgreSQL.

1. **Update your environment** to point to the temporary PostgreSQL instance:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/isms_db?schema=public"
```

2. **Generate Prisma Client** for PostgreSQL:

```bash
cd backend
npm run db:generate
```

3. **Create the schema** in PostgreSQL. Since you've migrated from SQLite, you have two options:

   **Option A: Create a new PostgreSQL migration (recommended)**
   ```bash
   npm run db:migrate -- --name init_postgres
   ```
   This creates a new migration file with PostgreSQL-compatible SQL.

   **Option B: Push schema directly (faster for temporary migration DB)**
   ```bash
   npx prisma db push
   ```
   This syncs the schema without creating migration files. Use this for the temporary migration database.

**Note:** The wrapper script (`run-prisma.sh`) has been updated to respect existing PostgreSQL `DATABASE_URL` environment variables. If you export `DATABASE_URL` before running Prisma commands, it will use that instead of the default SQLite path.

This will create all tables, indexes, and constraints in the PostgreSQL database.

## Step 3: Migrate Data from SQLite to PostgreSQL

Use an external tool to migrate the data. We recommend **pgloader** for this task.

### Option A: Using pgloader

Install pgloader:

```bash
# macOS
brew install pgloader

# Ubuntu/Debian
sudo apt-get install pgloader

# Or use Docker
docker pull dimitri/pgloader
```

Create a pgloader configuration file (`migrate.load`):

```lisp
LOAD DATABASE
  FROM sqlite:///path/to/backend/prisma/dev.db
  INTO postgresql://postgres:postgres@localhost:5433/isms_db?schema=public

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '256MB',
    maintenance_work_mem to '512MB'

CAST type datetime to timestamptz drop default drop not null using zero-dates-to-null,
     type date to date drop default drop not null using zero-dates-to-null

BEFORE LOAD DO
  $$ ALTER DATABASE isms_db SET timezone TO 'UTC'; $$;
```

Run the migration:

```bash
# Using installed pgloader
pgloader migrate.load

# Or using Docker
docker run --rm -it \
  -v /path/to/backend/prisma/dev.db:/data/dev.db:ro \
  -v /path/to/migrate.load:/migrate.load:ro \
  dimitri/pgloader:latest \
  pgloader /migrate.load
```

### Option B: Using Sequel (Alternative)

If you prefer using Sequel, you can use a script like this:

```ruby
# migrate.rb
require 'sequel'

sqlite_db = Sequel.connect('sqlite:///path/to/backend/prisma/dev.db')
pg_db = Sequel.connect('postgresql://postgres:postgres@localhost:5433/isms_db?schema=public')

# Define tables to migrate (in dependency order)
tables = [
  'AssetCategory',
  'Classification',
  'InterestedParty',
  'Legislation',
  'Control',
  'Asset',
  'Risk',
  'Document',
  'RiskControl',
  'DocumentRisk',
  'DocumentControl',
  'LegislationRisk'
]

tables.each do |table|
  puts "Migrating #{table}..."
  sqlite_db[table.to_sym].each do |row|
    pg_db[table.to_sym].insert(row)
  end
end
```

Run with:

```bash
sequel -m migrate.rb
```

## Step 4: Export Seed Data

Once the data is migrated, export it to seed JSON files for use across environments.

1. **Ensure DATABASE_URL points to the migrated PostgreSQL database:**

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/isms_db?schema=public"
```

2. **Run the export script:**

```bash
cd backend
npm run db:seed  # This will use the export script if configured
# Or directly:
tsx scripts/export-seed-data.ts
```

This will create JSON files in `backend/prisma/seed-data/`:
- `asset-categories.json`
- `assets.json`
- `risks.json`
- `controls.json`
- `documents.json`
- `interested-parties.json`
- `legislation.json`
- `risk-controls.json`
- `document-risks.json`
- `document-controls.json`
- `legislation-risks.json`

## Step 5: Switch All Environments to PostgreSQL

### Local Development

1. **Update `backend/.env`:**

```bash
# Remove SQLite DATABASE_URL
# Add PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/isms_db?schema=public
SEED_SCOPE=full
```

2. **Update `docker-compose.yml`** to include PostgreSQL service (see main docker-compose.yml for full configuration).

3. **Start services:**

```bash
docker compose up -d
```

### Staging Environment

1. **Set environment variables:**

```bash
DATABASE_URL=postgresql://user:password@staging-db-host:5432/isms_staging?schema=public
SEED_SCOPE=reference
NODE_ENV=staging
```

2. **Run migrations:**

```bash
npm run db:migrate:deploy
```

3. **Optionally seed reference data:**

```bash
SEED_SCOPE=reference npm run db:seed
```

### Production Environment

1. **Set environment variables:**

```bash
DATABASE_URL=postgresql://user:password@production-db-host:5432/isms_production?schema=public
SEED_SCOPE=none
NODE_ENV=production
```

2. **Run migrations:**

```bash
npm run db:migrate:deploy
```

3. **Do NOT run seed in production** (SEED_SCOPE=none ensures this).

## Step 6: Validate Migration

Use the validation script to verify that row counts match between the old SQLite database and the new PostgreSQL database.

1. **Set environment variables for both databases:**

```bash
# SQLite source (if still accessible)
export SQLITE_DB_PATH="/path/to/backend/prisma/dev.db"

# PostgreSQL target
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/isms_db?schema=public"
```

2. **Run the validation script:**

```bash
cd backend
tsx scripts/validate-postgres-migration.ts
```

The script will:
- Connect to both databases
- Count rows for each model
- Compare counts and report any discrepancies
- Exit with status code 0 if all counts match, non-zero if there are differences

Expected output:

```
Validating migration...
AssetCategory: SQLite=5, PostgreSQL=5 ✓
Asset: SQLite=10, PostgreSQL=10 ✓
Risk: SQLite=25, PostgreSQL=25 ✓
Control: SQLite=50, PostgreSQL=50 ✓
Document: SQLite=15, PostgreSQL=15 ✓
InterestedParty: SQLite=8, PostgreSQL=8 ✓
Legislation: SQLite=12, PostgreSQL=12 ✓
RiskControl: SQLite=30, PostgreSQL=30 ✓
DocumentRisk: SQLite=20, PostgreSQL=20 ✓
DocumentControl: SQLITE=18, PostgreSQL=18 ✓
LegislationRisk: SQLite=10, PostgreSQL=10 ✓

All row counts match! Migration validated successfully.
```

## Troubleshooting

### Connection Issues

- Verify PostgreSQL is running: `docker compose ps`
- Check connection string format: `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`
- Test connection: `psql postgresql://postgres:postgres@localhost:5433/isms_db`

### Migration Errors

- Check foreign key constraints are satisfied (migrate in dependency order)
- Verify data types are compatible
- Check for NULL values in NOT NULL columns
- Review pgloader logs for specific errors

### Seed Data Issues

- Ensure seed JSON files are valid JSON
- Check that required foreign keys exist before seeding
- Verify SEED_SCOPE is set correctly for your environment

## Cleanup

After successful migration and validation:

1. **Stop the temporary PostgreSQL instance:**

```bash
docker compose -f docker-compose.migration.yml down -v
```

2. **Remove the SQLite database file** (after backing up if needed):

```bash
# Backup first!
cp backend/prisma/dev.db backend/prisma/dev.db.backup

# Then remove (when confident migration is successful)
rm backend/prisma/dev.db
```

3. **Update documentation** to reflect PostgreSQL as the primary database.

## Rollback Plan

If you need to rollback to SQLite:

1. Export data from PostgreSQL back to SQLite (reverse migration)
2. Restore `backend/.env` with SQLite DATABASE_URL
3. Update `docker-compose.yml` to remove PostgreSQL service
4. Restart services

**Note:** Rollback is complex and not recommended. Always validate thoroughly before removing SQLite backups.

