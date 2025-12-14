# Linting Standards & Best Practices

This document provides comprehensive guidelines for writing code that passes ESLint checks. Use this as a reference when writing code or when AI tools generate code.

## Table of Contents

1. [TypeScript Rules](#typescript-rules)
2. [React Hooks Rules](#react-hooks-rules)
3. [Code Style](#code-style)
4. [Common Patterns](#common-patterns)
5. [Error Handling](#error-handling)
6. [Import Management](#import-management)

## TypeScript Rules

### Avoid `any` Type

**Rule**: `@typescript-eslint/no-explicit-any` warns against using `any`.

#### ❌ Incorrect
```typescript
function processData(data: any) {
  return data.value;
}

const response: any = await api.get('/api/users');
const users: any[] = response.data;
```

#### ✅ Correct
```typescript
// Use proper types
interface ApiResponse {
  value: string;
}

function processData(data: ApiResponse) {
  return data.value;
}

// Use existing types
import { User } from '../types/user';
const response = await api.get<User[]>('/api/users');
const users: User[] = response.data;

// Use unknown for truly unknown types
function processUnknown(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data');
}

// Use generics
function processGeneric<T>(data: T): T {
  return data;
}
```

### Unused Variables and Parameters

**Rule**: `@typescript-eslint/no-unused-vars` errors on unused variables.

#### ❌ Incorrect
```typescript
function Component({ prop1, prop2 }: Props) {
  // prop2 is never used
  return <div>{prop1}</div>;
}

const [value, setValue] = useState('');
// value is never used, only setValue

function handleClick(event: MouseEvent) {
  // event is never used
  doSomething();
}
```

#### ✅ Correct
```typescript
// Prefix unused with underscore
function Component({ prop1, _prop2 }: Props) {
  return <div>{prop1}</div>;
}

const [_value, setValue] = useState('');

function handleClick(_event: MouseEvent) {
  doSomething();
}

// Or omit if not needed
function handleClick() {
  doSomething();
}
```

### Type Definitions

#### ❌ Incorrect
```typescript
// Inline types when shared types exist
function UserCard({ user }: { user: { id: string; name: string } }) {
  return <div>{user.name}</div>;
}
```

#### ✅ Correct
```typescript
// Use shared types
import { User } from '../types/user';

function UserCard({ user }: { user: User }) {
  return <div>{user.name}</div>;
}

// Or define interface if component-specific
interface UserCardProps {
  user: User;
  onEdit?: (id: string) => void;
}

function UserCard({ user, onEdit }: UserCardProps) {
  return <div>{user.name}</div>;
}
```

## React Hooks Rules

### useEffect Dependencies

**Rule**: `react-hooks/exhaustive-deps` warns about missing dependencies.

#### ❌ Incorrect
```typescript
function Component({ userId }: Props) {
  const [data, setData] = useState(null);

  const fetchData = async () => {
    const response = await api.get(`/api/users/${userId}`);
    setData(response.data);
  };

  useEffect(() => {
    fetchData();
  }, []); // ❌ Missing userId and fetchData dependencies
}
```

#### ✅ Correct
```typescript
function Component({ userId }: Props) {
  const [data, setData] = useState(null);

  // Wrap in useCallback with proper dependencies
  const fetchData = useCallback(async () => {
    const response = await api.get(`/api/users/${userId}`);
    setData(response.data);
  }, [userId]); // Include userId dependency

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Include fetchData dependency
}
```

### useCallback for Functions Used in Effects

#### ❌ Incorrect
```typescript
function Component({ onSuccess }: Props) {
  const handleSubmit = async () => {
    await api.post('/api/submit');
    onSuccess(); // Using prop in function
  };

  useEffect(() => {
    handleSubmit();
  }, []); // ❌ Missing handleSubmit and onSuccess
}
```

#### ✅ Correct
```typescript
function Component({ onSuccess }: Props) {
  const handleSubmit = useCallback(async () => {
    await api.post('/api/submit');
    onSuccess();
  }, [onSuccess]); // Include onSuccess dependency

  useEffect(() => {
    handleSubmit();
  }, [handleSubmit]); // Include handleSubmit dependency
}
```

### useMemo for Expensive Computations

#### ❌ Incorrect
```typescript
function Component({ items }: Props) {
  // Expensive computation runs on every render
  const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name));
  
  return <div>{sortedItems.map(...)}</div>;
}
```

#### ✅ Correct
```typescript
function Component({ items }: Props) {
  // Memoize expensive computation
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]); // Include items dependency

  return <div>{sortedItems.map(...)}</div>;
}
```

### Multiple useEffect Dependencies

#### ❌ Incorrect
```typescript
function Component({ userId, filters }: Props) {
  useEffect(() => {
    fetchUsers(userId);
  }, [userId]); // ❌ Missing filters dependency if used

  useEffect(() => {
    applyFilters(filters);
  }, []); // ❌ Missing filters dependency
}
```

#### ✅ Correct
```typescript
function Component({ userId, filters }: Props) {
  const fetchUsers = useCallback(async (id: string) => {
    // ... fetch logic
  }, []);

  const applyFilters = useCallback((f: Filters) => {
    // ... filter logic
  }, []);

  useEffect(() => {
    fetchUsers(userId);
  }, [userId, fetchUsers]);

  useEffect(() => {
    applyFilters(filters);
  }, [filters, applyFilters]);
}
```

## Code Style

### Prefer const Over let

**Rule**: `prefer-const` warns when `let` is used but never reassigned.

#### ❌ Incorrect
```typescript
let items = [];
let count = 0;
let user = getUser();

// None of these are reassigned
```

#### ✅ Correct
```typescript
const items = [];
const count = 0;
const user = getUser();
```

### Only Use let When Reassigning

#### ✅ Correct
```typescript
let count = 0;
count++; // Reassignment needed

let currentItem = null;
for (const item of items) {
  if (item.isActive) {
    currentItem = item; // Reassignment needed
  }
}
```

## Error Handling

### Proper Error Typing

#### ❌ Incorrect
```typescript
try {
  await api.post('/api/data', payload);
} catch (error: any) {
  console.error(error.response?.data?.error);
}
```

#### ✅ Correct
```typescript
import { AxiosError } from 'axios';

try {
  await api.post('/api/data', payload);
} catch (error) {
  const axiosError = error as AxiosError<{ error: string }>;
  console.error(axiosError.response?.data?.error);
  
  // Or handle unknown errors
  if (axiosError.response) {
    console.error(axiosError.response.data.error);
  } else {
    console.error('Network error:', axiosError.message);
  }
}
```

### Error Response Types

#### ✅ Correct
```typescript
interface ErrorResponse {
  error: string;
  details?: string;
  errors?: Array<{ msg: string; field: string }>;
}

try {
  await api.post('/api/data', payload);
} catch (error) {
  const axiosError = error as AxiosError<ErrorResponse>;
  const errorMessage = 
    axiosError.response?.data?.details ||
    axiosError.response?.data?.error ||
    axiosError.response?.data?.errors?.[0]?.msg ||
    'An error occurred';
  
  toast({
    title: 'Error',
    description: errorMessage,
    status: 'error',
  });
}
```

## Import Management

### Remove Unused Imports

#### ❌ Incorrect
```typescript
import { useState, useEffect, useMemo } from 'react'; // useMemo unused
import { Button, Box, Text } from '@chakra-ui/react'; // Text unused
import api from '../services/api';
import { User } from '../types/user';
import { formatDate } from '../utils'; // formatDate unused
```

#### ✅ Correct
```typescript
import { useState, useEffect } from 'react';
import { Button, Box } from '@chakra-ui/react';
import api from '../services/api';
import { User } from '../types/user';
```

### Import Order

#### ✅ Correct Order
```typescript
// 1. React imports
import { useState, useEffect, useCallback } from 'react';

// 2. External library imports
import { Button, Box, useToast } from '@chakra-ui/react';
import { AxiosError } from 'axios';

// 3. Internal service imports
import api from '../services/api';
import { authService } from '../services/authService';

// 4. Type imports
import { User, Risk, Control } from '../types';

// 5. Relative imports (components, utils, hooks)
import { DataTable } from '../components/DataTable';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils';
```

## Common Patterns

### Component with API Call

#### ✅ Complete Example
```typescript
import { useState, useEffect, useCallback } from 'react';
import { Box, Spinner } from '@chakra-ui/react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { User } from '../types/user';

interface UserListProps {
  departmentId?: string;
  onUserSelect?: (user: User) => void;
}

export function UserList({ departmentId, onUserSelect }: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!departmentId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<User[]>(`/api/users?department=${departmentId}`);
      setUsers(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUserClick = useCallback((user: User) => {
    onUserSelect?.(user);
  }, [onUserSelect]);

  if (loading) return <Spinner />;
  if (error) return <Box color="red">{error}</Box>;

  return (
    <Box>
      {users.map((user) => (
        <Box key={user.id} onClick={() => handleUserClick(user)}>
          {user.name}
        </Box>
      ))}
    </Box>
  );
}
```

### Form Handling

#### ✅ Complete Example
```typescript
import { useState, useCallback, FormEvent } from 'react';
import { Button, Input, FormControl, FormLabel } from '@chakra-ui/react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { User } from '../types/user';

interface UserFormProps {
  user?: User;
  onSuccess: () => void;
}

export function UserForm({ user, onSuccess }: UserFormProps) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      const payload = { name, email };
      
      if (user) {
        await api.put(`/api/users/${user.id}`, payload);
      } else {
        await api.post('/api/users', payload);
      }
      
      onSuccess();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string; details?: string }>;
      const errorMessage = 
        axiosError.response?.data?.details ||
        axiosError.response?.data?.error ||
        'Failed to save user';
      
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [name, email, user, onSuccess]);

  return (
    <form onSubmit={handleSubmit}>
      <FormControl>
        <FormLabel>Name</FormLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>Email</FormLabel>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormControl>
      <Button type="submit" isLoading={submitting}>
        {user ? 'Update' : 'Create'}
      </Button>
    </form>
  );
}
```

## Quick Reference Checklist

When writing code, ensure:

- [ ] No `any` types - use proper types or `unknown`
- [ ] Unused variables/parameters prefixed with `_`
- [ ] All `useEffect` dependencies included
- [ ] Functions in dependency arrays wrapped with `useCallback`
- [ ] Expensive computations wrapped with `useMemo`
- [ ] `const` used instead of `let` when possible
- [ ] Unused imports removed
- [ ] Proper error typing with `AxiosError`
- [ ] Types imported from `types/` directory when available
- [ ] Import order follows convention

## Running Linting

```bash
# Check all files (strict - no warnings)
npm run lint

# Check with warnings allowed (for tracking)
npm run lint:check

# Auto-fix issues
npm run lint:fix

# Track warning count over time
npm run lint:track
npm run lint:report
```

## Additional Resources

- `.cursorrules` - AI tool configuration
- `LINTING.md` - Linting strategy and tools
- `frontend/.eslintrc.cjs` - Frontend ESLint config
- `backend/.eslintrc.json` - Backend ESLint config








