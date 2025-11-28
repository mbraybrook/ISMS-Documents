# Database Configuration

## Environment Files

This project uses environment files with a specific configuration:

1. **Root `.env`** (`/ISMS-Documentation/.env`) - Project-wide defaults
   - **Does NOT contain `DATABASE_URL`** - This prevents path resolution conflicts
   - Contains other project-wide settings (PORT, NODE_ENV, etc.)

2. **Backend `.env`** (`/ISMS-Documentation/backend/.env`) - Backend-specific configuration
   - **Contains: `DATABASE_URL=file:./prisma/dev.db`** (relative to backend directory)
   - This is the **only** place where `DATABASE_URL` should be defined
   - Uses a relative path for portability

## Loading Order

The `config.ts` file loads environment variables in this order (last one wins):
1. Current directory `.env` (lowest priority)
2. Root `.env` (middle priority) - **Does not contain DATABASE_URL**
3. Backend `.env` (highest priority - loaded last) - **Contains DATABASE_URL**

**Important:** Only `backend/.env` should contain `DATABASE_URL` to avoid path resolution conflicts.

## Path Resolution

### For Application Code
- The `config.ts` file automatically resolves relative paths to absolute paths
- Always resolves relative to the **backend directory**
- Example: `file:./prisma/dev.db` → `file:/absolute/path/to/backend/prisma/dev.db`

### For Prisma CLI Commands
- Prisma CLI reads `DATABASE_URL` directly from `.env` files
- **Always run Prisma commands from the `backend/` directory**
- The relative path `file:./prisma/dev.db` will resolve correctly when run from `backend/`

## Best Practices

1. **Use relative paths in `.env` files** - Makes the project portable
2. **Always use npm scripts for Prisma commands** - They use a wrapper script that ensures correct path resolution:
   ```bash
   npm run db:migrate      # Uses wrapper script with absolute path
   npm run db:migrate:deploy  # Uses wrapper script with absolute path
   npm run db:generate     # Uses wrapper script with absolute path
   npm run db:studio       # Uses wrapper script with absolute path
   npm run db:status       # Uses wrapper script with absolute path
   ```
3. **Never run `npx prisma` directly** - Always use the npm scripts to avoid path resolution issues
4. **The wrapper script** (`scripts/run-prisma.sh`) automatically resolves the database path to an absolute path, preventing the nested `prisma/prisma/dev.db` issue

## Troubleshooting

If you see errors about database files in `prisma/prisma/dev.db`:
- Make sure you're running Prisma commands from the `backend/` directory
- Check that `backend/.env` has `DATABASE_URL=file:./prisma/dev.db` (relative path)
- Verify the path resolves correctly: `cd backend && npx prisma migrate status`

## Database Location

The database file is always located at:
```
backend/prisma/dev.db
```

This is the **only** location. If you see files in `backend/prisma/prisma/dev.db`, something is wrong with path resolution.

