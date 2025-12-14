/* eslint-disable react-refresh/only-export-components */
import { ReactElement } from 'react';
import { render, RenderOptions, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';

// Custom render function that includes all providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ChakraProvider>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => {
  // Render the component
  // React Testing Library's render() already wraps in act() internally
  const result = render(ui, { wrapper: AllTheProviders, ...options });
  
  return result;
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Helper to create mock user data
export const createMockUser = (overrides?: Partial<{ id: string; email: string; displayName: string; role: string }>) => ({
  id: 'user-1',
  email: 'test@paythru.com',
  displayName: 'Test User',
  role: 'ADMIN',
  ...overrides,
});

// Helper to wait for async operations to complete
// Use this after rendering components with cascading useEffect hooks
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

// Helper to wait for all pending promises and React updates to complete
// Use this after rendering components with cascading useEffect hooks
export const waitForStable = async () => {
  // Wait for all microtasks and React updates to complete
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};


