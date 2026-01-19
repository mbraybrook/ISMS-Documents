# AGENTS.md - AI Coding Assistant Guidelines

This document provides essential guidelines for AI coding assistants (Cursor/Composer, Antigravity/Windsurf, etc.) working on the ISMS Documentation project.

## Core Principles

### 1. Write Tests for All Code
**MANDATORY**: Every new function, component, route, service, or feature **MUST** include comprehensive tests.

- **Backend**: Write Jest tests in `backend/src/**/__tests__/` directories
- **Frontend**: Write Vitest tests with React Testing Library in `frontend/src/**/__tests__/` directories
- **E2E**: Write Playwright tests in `e2e/` directory for critical user flows
- **Coverage Target**: Maintain 80%+ test coverage across all metrics (lines, functions, branches, statements)
- **Test Quality**: Focus on meaningful tests that verify behavior, not just code coverage numbers

**Before submitting any code:**
- ✅ All tests pass (`npm test`)
- ✅ New code has corresponding tests
- ✅ Test coverage meets or exceeds 80%
- ✅ Tests follow existing patterns and conventions

See `docs/testing.md` and `.cursor/rules/testing.mdc` for detailed testing guidelines.

### 2. Use Context7 MCP for Standards Compliance
**ALWAYS** consult Context7 MCP (Model Context Protocol) for guidance on writing standards-compliant code.

- Use Context7 MCP to verify code follows industry best practices
- Check against relevant coding standards (TypeScript, React, Node.js, etc.)
- Ensure compliance with security best practices
- Validate architectural patterns and design decisions
- Reference Context7 MCP when making decisions about code structure, naming conventions, and patterns

**When in doubt:**
1. Consult Context7 MCP for standards guidance
2. Review existing codebase patterns
3. Check `global_rules.md` for project-specific standards
4. Follow TypeScript and React best practices

## Project Standards

### Code Quality
- **TypeScript**: Strict typing, no `any` types (use `unknown` when necessary)
- **Linting**: Zero warnings allowed for staged files (enforced by pre-commit hook)
- **Formatting**: Follow existing code style and use auto-formatters
- **Error Handling**: Proper error types and handling throughout

### Architecture
- **Frontend**: React + TypeScript + Vite + Chakra UI
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Jest (backend), Vitest (frontend), Playwright (E2E)

### File Organization
- **Backend**: `backend/src/` with routes, services, middleware, types
- **Frontend**: `frontend/src/` with components, contexts, services, types
- **Tests**: Co-located in `__tests__/` directories
- **E2E**: `e2e/` directory at root

## Development Workflow

### Before Writing Code
1. Review existing similar code to understand patterns
2. Check `global_rules.md` for project-specific standards
3. Consult Context7 MCP for industry best practices
4. Plan test strategy alongside feature implementation

### While Writing Code
1. Write code following TypeScript and React best practices
2. Write tests **simultaneously** with implementation (TDD approach preferred)
3. Ensure all functions/components are properly typed
4. Follow existing code patterns and conventions
5. Use proper error handling and validation

### Before Committing
1. Run all tests: `npm test`
2. Check test coverage: `npm run test:coverage`
3. Run linter: `npm run lint`
4. Fix all linting errors and warnings
5. Ensure all tests pass (pre-commit hook will enforce this)

## Key Resources

- **Testing Guide**: `docs/testing.md`
- **Coding Standards**: `global_rules.md`
- **Linting Rules**: `LINTING_STANDARDS.md` and `LINTING.md`
- **Testing Rules**: `.cursor/rules/testing.mdc`
- **Project README**: `README.md`

## Common Patterns

### Backend Route Handler
```typescript
// ✅ Good: Properly typed, tested, error handling
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const schema = z.object({
  // validation schema
});

export async function myRouteHandler(req: Request, res: Response) {
  try {
    const validated = schema.parse(req.body);
    const result = await prisma.model.findMany();
    res.json(result);
  } catch (error) {
    // proper error handling
  }
}
```

### Frontend Component
```typescript
// ✅ Good: Properly typed, tested, hooks used correctly
import { useState, useEffect, useCallback } from 'react';
import { Box, Button } from '@chakra-ui/react';
import api from '../services/api';
import { User } from '../types/user';

interface MyComponentProps {
  userId: string;
  onSuccess: () => void;
}

export function MyComponent({ userId, onSuccess }: MyComponentProps) {
  const [data, setData] = useState<User | null>(null);
  
  const fetchData = useCallback(async () => {
    const response = await api.get(`/api/users/${userId}`);
    setData(response.data);
  }, [userId]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return <Box>{/* component JSX */}</Box>;
}
```

## Testing Requirements

### Test Coverage
- **Minimum**: 80% coverage on all metrics
- **Critical Paths**: 100% coverage (auth, data operations, business logic)
- **Edge Cases**: Test error handling, boundary conditions, invalid inputs

### Test Structure
- Use AAA pattern (Arrange-Act-Assert)
- Clear, descriptive test names
- Isolated tests (no dependencies between tests)
- Proper mocking of external dependencies

### Example Test
```typescript
// ✅ Good: Clear structure, proper mocking, meaningful assertions
describe('MyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user data when user exists', async () => {
    // Arrange
    const mockUser = createMockUser({ id: '1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    
    // Act
    const result = await myService.getUser('1');
    
    // Assert
    expect(result).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '1' }
    });
  });
});
```

## Important Reminders

1. **Tests are mandatory** - No code without tests
2. **Use Context7 MCP** - Always verify standards compliance
3. **Follow existing patterns** - Consistency is key
4. **Type everything** - No `any` types
5. **Handle errors properly** - Don't ignore error cases
6. **Document complex logic** - Comments for non-obvious code
7. **Run tests before committing** - Pre-commit hook will catch failures

## Questions?

- Review existing code for patterns
- Check documentation in `docs/` directory
- Consult Context7 MCP for standards guidance
- Refer to `global_rules.md` for project-specific rules
