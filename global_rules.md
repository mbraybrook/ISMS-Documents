# ISMS Documentation - Coding Standards & Linting Rules

This file provides instructions for AI coding assistants (Antigravity/Windsurf) to write code that complies with our ESLint rules and coding standards.

## TypeScript Rules

### Never Use `any` Type
- **Rule**: `@typescript-eslint/no-explicit-any` is set to `warn`
- **Instead of**: `const data: any = ...`
- **Use**: 
  - Proper types: `const data: User = ...`
  - `unknown` for truly unknown types: `const data: unknown = ...`
  - Type assertions when necessary: `const data = response as User`
  - Generic types: `const data: ApiResponse<User> = ...`

### Unused Variables/Parameters
- **Rule**: `@typescript-eslint/no-unused-vars` is set to `error`
- **Pattern**: Prefix unused variables/parameters with `_`
- **Examples**:
  ```typescript
  // ✅ Correct
  function handleClick(_event: MouseEvent) { ... }
  const [_unused, setValue] = useState();
  
  // ❌ Incorrect
  function handleClick(event: MouseEvent) { ... } // unused
  const [unused, setValue] = useState(); // unused
  ```

### Type Definitions
- Always use types from `frontend/src/types/` or `backend/src/types/` when available
- Import types explicitly: `import { User, Risk, Control } from '../types/...'`
- Don't inline type definitions when a shared type exists

## React Hooks Rules

### useEffect Dependencies
- **Rule**: `react-hooks/exhaustive-deps` is set to `warn`
- **Always include all dependencies** used inside useEffect
- **Wrap functions in useCallback** if they're used as dependencies

**Correct Pattern**:
```typescript
const fetchData = useCallback(async () => {
  const response = await api.get('/api/data');
  setData(response.data);
}, []); // Empty deps if no external dependencies

useEffect(() => {
  fetchData();
}, [fetchData]); // Include fetchData in deps
```

**Incorrect Pattern**:
```typescript
const fetchData = async () => { ... }; // Not wrapped in useCallback

useEffect(() => {
  fetchData();
}, []); // ❌ Missing fetchData dependency
```

### useCallback and useMemo
- Wrap functions used in dependency arrays with `useCallback`
- Wrap expensive computations with `useMemo`
- Include all external dependencies in dependency arrays

**Example**:
```typescript
// ✅ Correct
const handleSubmit = useCallback(async (data: FormData) => {
  await api.post('/api/submit', data);
  onSuccess();
}, [onSuccess]); // Include onSuccess if it's a prop

// ❌ Incorrect
const handleSubmit = async (data: FormData) => { ... }; // Not memoized
```

## Code Style

### Variable Declarations
- **Rule**: `prefer-const` is enabled
- Use `const` by default, only use `let` when reassignment is needed
- **Example**:
  ```typescript
  // ✅ Correct
  const items = [];
  const count = 0;
  
  // ❌ Incorrect
  let items = []; // Never reassigned
  let count = 0; // Never reassigned
  ```

### Imports
- Remove unused imports immediately
- Group imports: external packages, then internal modules
- Use named imports when possible

**Example**:
```typescript
// ✅ Correct
import { useState, useEffect, useCallback } from 'react';
import { Button, Box } from '@chakra-ui/react';
import api from '../services/api';
import { User } from '../types/user';

// ❌ Incorrect
import { useState, useEffect, useMemo } from 'react'; // useMemo unused
```

### Error Handling
- Use proper TypeScript types for error handling
- **Example**:
  ```typescript
  // ✅ Correct
  import { AxiosError } from 'axios';
  try {
    await api.post('/api/data', payload);
  } catch (error) {
    const axiosError = error as AxiosError<{ error: string }>;
    console.error(axiosError.response?.data?.error);
  }
  
  // ❌ Incorrect
  try {
    await api.post('/api/data', payload);
  } catch (error: any) { // Using any
    console.error(error.response?.data?.error);
  }
  ```

## React Component Patterns

### Component Props
- Always define proper TypeScript interfaces for props
- Use existing types from `types/` directory when available
- **Example**:
  ```typescript
  // ✅ Correct
  interface UserCardProps {
    user: User;
    onEdit: (id: string) => void;
  }
  
  export function UserCard({ user, onEdit }: UserCardProps) { ... }
  
  // ❌ Incorrect
  export function UserCard({ user, onEdit }: any) { ... }
  ```

### State Management
- Use proper types for useState
- **Example**:
  ```typescript
  // ✅ Correct
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // ❌ Incorrect
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Can infer, but explicit is better
  ```

## File Organization

### Import Order
1. React and React-related imports
2. External library imports (Chakra UI, etc.)
3. Internal service imports
4. Type imports
5. Relative imports (components, utils, etc.)

**Example**:
```typescript
import { useState, useEffect, useCallback } from 'react';
import { Button, Box, useToast } from '@chakra-ui/react';
import api from '../services/api';
import { User, Risk } from '../types';
import { formatDate } from '../utils';
```

## Common Patterns to Avoid

### ❌ Don't Do This:
```typescript
// Using any
const data: any = await api.get('/api/data');

// Missing dependencies
useEffect(() => {
  fetchData();
}, []); // fetchData not in deps

// Unused variables
function Component({ prop1, prop2 }) {
  // prop2 never used
}

// Using let unnecessarily
let count = 0; // Never reassigned
```

### ✅ Do This Instead:
```typescript
// Proper typing
const data: ApiResponse<User> = await api.get('/api/data');

// Correct dependencies
const fetchData = useCallback(async () => { ... }, []);
useEffect(() => {
  fetchData();
}, [fetchData]);

// Prefix unused with _
function Component({ prop1, _prop2 }: Props) {
  // _prop2 intentionally unused
}

// Use const
const count = 0;
```

## Pre-commit Hook

- A pre-commit hook runs ESLint on staged files
- **Zero warnings allowed** for staged files (`--max-warnings 0`)
- Fix linting issues before committing
- Use `npm run lint:fix` to auto-fix some issues

## Running Linting

- **Check all files**: `npm run lint`
- **Check with warnings allowed**: `npm run lint:check`
- **Auto-fix**: `npm run lint:fix`
- **Track warning count**: `npm run lint:track`

## Additional Resources

- See `LINTING_STANDARDS.md` for detailed examples
- See `LINTING.md` for linting strategy and tools
- ESLint configs: `frontend/.eslintrc.cjs`, `backend/.eslintrc.json`

