# Prisma Database Commands

## ⚠️ IMPORTANT: Always Use npm Scripts

**DO NOT run `npx prisma` commands directly!**

Always use the npm scripts which use a wrapper that ensures correct path resolution:

```bash
# ✅ CORRECT - Use npm scripts
npm run db:migrate
npm run db:generate
npm run db:studio
npm run db:status

# ❌ WRONG - Don't use npx directly
npx prisma migrate dev
npx prisma generate
npx prisma studio
```

## Why?

The wrapper script (`scripts/run-prisma.sh`) ensures that:
1. `DATABASE_URL` is always resolved to an absolute path
2. Commands are always run from the correct directory
3. The nested `prisma/prisma/dev.db` path issue is prevented

## Available Commands

- `npm run db:migrate` - Create and apply migrations
- `npm run db:migrate:deploy` - Apply migrations (production)
- `npm run db:migrate:create` - Create migration without applying
- `npm run db:generate` - Generate Prisma Client
- `npm run db:studio` - Open Prisma Studio
- `npm run db:status` - Check migration status

## Database Path

The database is located at: `backend/prisma/dev.db`

The `.env` file contains: `DATABASE_URL=file:./prisma/dev.db`

This relative path is automatically resolved to an absolute path by:
1. The wrapper script (for CLI commands)
2. The `config.ts` file (for application code)

## Troubleshooting

If you see an error about `prisma/prisma/dev.db`:
1. Check that you're using npm scripts, not `npx prisma` directly
2. Verify the wrapper script exists and is executable: `chmod +x scripts/run-prisma.sh`
3. Check that you're running commands from the `backend/` directory
4. Remove any nested `prisma/prisma/` directories if they exist

