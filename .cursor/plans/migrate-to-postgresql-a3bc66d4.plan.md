<!-- a3bc66d4-1153-4045-a234-6dce14671384 b3c62ad5-8f5d-4d08-82ca-6f5c6b875375 -->
# Database Migration from SQLite to PostgreSQL

## Overview

Migrate the application from SQLite to PostgreSQL for all environments (local, staging, production). Export existing data from SQLite and create a seed data structure for promoting data between environments.

## Implementation Steps

### 1. Update Prisma Schema

- Change `provider` from `"sqlite"` to `"postgresql"` in `backend/prisma/schema.prisma`
- Update `DATABASE_URL` format to support PostgreSQL connection strings
- Note: Prisma will handle most SQL differences, but we'll need to review any SQLite-specific features

### 2. Update Configuration

- Modify `backend/src/config.ts` to handle PostgreSQL connection strings (not just `file:` URLs)
- Support both `postgresql://` and `postgres://` connection string formats
- Update environment variable handling for database URL

### 3. Create Data Migration Script

- Create `backend/scripts/migrate-sqlite-to-postgres.ts`:
- Connect to existing SQLite database
- Connect to target PostgreSQL database
- Export data from SQLite for these models:
- AssetCategory
- Classification (if needed for Assets)
- Asset
- InterestedParty
- Legislation
- Risk
- Control
- Document
- RiskControl (junction table)
- DocumentRisk (junction table)
- DocumentControl (junction table)
- LegislationRisk (junction table)
- Import data into PostgreSQL, preserving relationships
- Handle foreign key dependencies correctly (import in order)
- Preserve IDs to maintain relationships

### 4. Create Seed Data Structure

- Create `backend/prisma/seed.ts` following Prisma's documented seeding pattern:
- Export a default `main()` function that uses `@prisma/client`
- Use `upsert()` for each model (AssetCategory, Asset, Risk, Control, Document, InterestedParty, Legislation, and junction tables) to make it safe to run multiple times
- Handle `process.env.SEED_SCOPE` with three modes:
- `"reference"`: seed only canonical/catalogue data (Asset Categories, base Controls, Legislation)
- `"full"`: reference data + sample/demo Risks, Documents, links
- `"none"`: do nothing (skip seeding)
- Take `process.env.NODE_ENV` into account (e.g., skip seeding in production unless explicitly enabled)
- Load seed payloads from JSON files under `backend/prisma/seed-data/`:
- One file per model: `asset-categories.json`, `assets.json`, `risks.json`, `controls.json`, `documents.json`, `interested-parties.json`, `legislation.json`
- Junction tables: `risk-controls.json`, `document-risks.json`, `document-controls.json`, `legislation-risks.json`
- Configure Prisma seed in `package.json`:
- Add `"prisma"` field with `"seed"` property pointing to `tsx prisma/seed.ts` (or equivalent)
- This allows `prisma db seed` to work correctly

### 5. Update Docker Configuration

- Add PostgreSQL service to `docker-compose.yml`:
- PostgreSQL container with appropriate version
- Environment variables for database setup
- Volume for data persistence
- Health checks (required for depends_on condition)
- Update backend service to:
- Use PostgreSQL connection string
- Set startup command to: `sh -c "npx prisma migrate deploy && npx prisma db seed && npm start"` for non-production environments
- Add `depends_on` with `condition: service_healthy` referencing the Postgres service healthcheck
- This ensures backend only starts after Postgres is ready

### 6. Update Environment Files

- Create/update `.env.example` files with PostgreSQL connection string format
- Document required environment variables
- Update `backend/.env` for local development with PostgreSQL

### 7. Create Migration Guide

- Document the migration process
- Include steps for:
- Running the SQLite to PostgreSQL migration script
- Setting up PostgreSQL locally
- Updating environment variables
- Running migrations on new database

### 8. Update Documentation

- Update `README.md` with PostgreSQL setup instructions
- Update database-related documentation
- Remove SQLite-specific references

## Files to Modify

- `backend/prisma/schema.prisma` - Change provider to postgresql
- `backend/src/config.ts` - Update database URL handling
- `docker-compose.yml` - Add PostgreSQL service
- `backend/package.json` - Update seed script if needed
- `README.md` - Update database documentation

## Files to Create

- `backend/scripts/validate-postgres-migration.ts` - Validation script to verify row counts match
- `backend/scripts/export-seed-data.ts` - Utility to export data from Postgres to seed JSON files
- `backend/prisma/seed.ts` - Seed data loader
- `backend/prisma/seed-data/` - Directory for seed data files
- `backend/.env.example` - Example environment file with PostgreSQL config
- `docs/database-migration.md` - Migration guide with external tool instructions

## Key Considerations

- Foreign key relationships must be preserved during migration
- IDs should be preserved to maintain referential integrity
- Seed data should be optional and idempotent (can run multiple times safely)
- Migration script should handle errors gracefully
- Support for both local development and production deployment patterns

### To-dos

- [ ] Update Prisma schema to use PostgreSQL provider instead of SQLite
- [ ] Update config.ts to handle PostgreSQL connection strings (postgresql:// or postgres://)
- [ ] Create migrate-sqlite-to-postgres.ts script to export data from SQLite and import to PostgreSQL
- [ ] Create seed.ts and seed-data directory structure for promoting data between environments
- [ ] Add PostgreSQL service to docker-compose.yml and update backend service configuration
- [ ] Create/update .env.example files with PostgreSQL connection string format
- [ ] Update README.md and create migration guide documentation