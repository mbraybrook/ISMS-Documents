# Testing Guide

This document provides comprehensive information about the testing framework, how to write tests, and how to run them.

## Overview

The project uses a comprehensive testing strategy with three levels of testing:

1. **Unit Tests** - Test individual functions and components in isolation
2. **Integration Tests** - Test how different parts of the system work together
3. **E2E Tests** - Test complete user workflows end-to-end

## Test Structure

### Backend Tests

Backend tests use **Jest** and are located in `backend/src/**/__tests__/` directories.

```
backend/
├── src/
│   ├── middleware/
│   │   └── __tests__/
│   │       ├── auth.test.ts
│   │       └── authorize.test.ts
│   ├── routes/
│   │   └── __tests__/
│   │       ├── documents.test.ts
│   │       ├── acknowledgments.test.ts
│   │       └── risks.test.ts
│   └── services/
│       └── __tests__/
│           ├── riskService.test.ts
│           ├── soaService.test.ts
│           ├── sharePointService.test.ts
│           └── confluenceService.test.ts
└── jest.config.js
```

### Frontend Tests

Frontend tests use **Vitest** and **React Testing Library** and are located in `frontend/src/**/__tests__/` directories.

```
frontend/
├── src/
│   ├── components/
│   │   └── __tests__/
│   │       └── ProtectedRoute.test.tsx
│   ├── contexts/
│   │   └── __tests__/
│   │       └── AuthContext.test.tsx
│   ├── services/
│   │   └── __tests__/
│   │       ├── authService.test.ts
│   │       └── api.test.ts
│   └── test/
│       ├── setup.ts
│       ├── utils.tsx
│       └── mocks/
│           ├── server.ts
│           ├── handlers.ts
│           └── msal.ts
└── vitest.config.ts
```

### E2E Tests

E2E tests use **Playwright** and are located in the `e2e/` directory.

```
e2e/
├── auth.spec.ts
├── document-management.spec.ts
├── acknowledgment.spec.ts
├── soa-export.spec.ts
└── helpers/
    ├── auth.ts
    ├── db.ts
    ├── global-setup.ts
    └── global-teardown.ts
```

## Running Tests

### Backend Tests

```bash
# Run all backend tests
cd backend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

### Frontend Tests

```bash
# Run all frontend tests
cd frontend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/auth.spec.ts
```

### All Tests

```bash
# Run all tests (backend + frontend)
npm test

# Run all tests with coverage
npm run test:coverage

# Run all tests in watch mode
npm run test:watch
```

## Writing Tests

### Backend Test Example

```typescript
import { createMockUser, createMockAuthRequest } from '../../lib/test-helpers';
import { prisma } from '../../lib/prisma';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('MyRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', async () => {
    const mockUser = createMockUser({ role: 'ADMIN' });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    // Test implementation
    expect(true).toBe(true);
  });
});
```

### Frontend Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { render as customRender } from '../../test/utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    customRender(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('My Feature', () => {
  test('should work correctly', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/my-feature');
    
    await expect(page.locator('h1')).toContainText('My Feature');
  });
});
```

## Test Helpers

### Backend Helpers

Located in `backend/src/lib/test-helpers.ts`:

- `createMockUser()` - Create mock user objects
- `createMockAuthUser()` - Create mock auth user objects
- `createMockRequest()` - Create mock Express requests
- `createMockResponse()` - Create mock Express responses
- `mockUsers` - Pre-configured mock users for different roles

### Frontend Helpers

Located in `frontend/src/test/utils.tsx`:

- `render()` - Custom render function with all providers
- `createMockUser()` - Create mock user data

### E2E Helpers

Located in `e2e/helpers/`:

- `loginAs()` - Login as a specific role
- `logout()` - Logout current user
- `createTestDocument()` - Create test documents
- `createTestRisk()` - Create test risks
- `cleanupTestData()` - Clean up test data

## Coverage Goals

- **Backend**: 80%+ coverage on critical paths (auth, documents, risks, acknowledgments)
- **Frontend**: 70%+ coverage on components and services
- **E2E**: All critical user flows covered

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The CI pipeline:
1. Runs backend unit tests
2. Runs frontend unit/component tests
3. Runs E2E tests
4. Generates coverage reports
5. Uploads coverage to Codecov

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Services**: Mock SharePoint, Confluence, and MSAL
3. **Use Test Helpers**: Leverage existing test utilities
4. **Clear Test Names**: Use descriptive test names
5. **Arrange-Act-Assert**: Structure tests clearly
6. **Avoid Flaky Tests**: Use proper waits and selectors in E2E tests

## Troubleshooting

### Backend Tests Failing

- Ensure DATABASE_URL is set correctly
- Check that Prisma client is generated: `npm run db:generate`
- Verify mocks are set up correctly

### Frontend Tests Failing

- Ensure MSW handlers are set up correctly
- Check that MSAL mocks are in place
- Verify test utilities are imported correctly

### E2E Tests Failing

- Ensure test database is set up
- Check that authentication helpers are working
- Verify web server is running

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)

