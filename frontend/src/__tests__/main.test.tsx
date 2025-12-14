import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChakraProvider } from '@chakra-ui/react';
import React from 'react';

// Mock ReactDOM before importing main.tsx
const mockRender = vi.fn();
const mockCreateRoot = vi.fn(() => ({
  render: mockRender,
}));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: mockCreateRoot,
  },
}));

// Mock App component
const MockApp = () => <div>Mock App</div>;
vi.mock('../App', () => ({
  default: MockApp,
}));

// Mock index.css import (side effect only)
vi.mock('../index.css', () => ({}));

describe('main.tsx', () => {
  let mockRootElement: HTMLElement;
  let originalGetElementById: typeof document.getElementById;

  beforeEach(() => {
    // Reset module cache to allow re-importing main.tsx
    vi.resetModules();

    // Create a mock root element
    mockRootElement = document.createElement('div');
    mockRootElement.id = 'root';

    // Mock document.getElementById
    originalGetElementById = document.getElementById;
    document.getElementById = vi.fn((id: string) => {
      if (id === 'root') {
        return mockRootElement;
      }
      return null;
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original implementation
    document.getElementById = originalGetElementById;
    vi.restoreAllMocks();
  });

  it('should call ReactDOM.createRoot with the root element', async () => {
    // Arrange: Import main.tsx (this will execute the code)
    await import('../main');

    // Assert: createRoot should be called with the root element
    expect(mockCreateRoot).toHaveBeenCalledTimes(1);
    expect(mockCreateRoot).toHaveBeenCalledWith(mockRootElement);
  });

  it('should render React.StrictMode wrapper', async () => {
    // Arrange
    await import('../main');

    // Assert: render should be called once
    expect(mockRender).toHaveBeenCalledTimes(1);

    // Get the rendered component
    const renderCall = mockRender.mock.calls[0][0];
    
    // Verify it's wrapped in StrictMode
    expect(renderCall.type).toBe(React.StrictMode);
  });

  it('should render ChakraProvider with correct theme configuration', async () => {
    // Arrange
    await import('../main');

    // Assert: render should be called
    expect(mockRender).toHaveBeenCalledTimes(1);

    // Get the rendered component tree
    const renderCall = mockRender.mock.calls[0][0];
    const strictModeChildren = renderCall.props.children;
    
    // Verify ChakraProvider is present
    expect(strictModeChildren.type).toBe(ChakraProvider);
    
    // Verify theme configuration
    const theme = strictModeChildren.props.theme;
    expect(theme).toBeDefined();
    expect(theme.config).toBeDefined();
    expect(theme.config.initialColorMode).toBe('light');
    expect(theme.config.useSystemColorMode).toBe(false);
    expect(theme.components).toBeDefined();
    expect(theme.components.Toast).toBeDefined();
    expect(theme.components.Toast.defaultProps).toBeDefined();
    expect(theme.components.Toast.defaultProps.position).toBe('top-right');
  });

  it('should render App component inside ChakraProvider', async () => {
    // Arrange
    await import('../main');

    // Assert: render should be called
    expect(mockRender).toHaveBeenCalledTimes(1);

    // Get the rendered component tree
    const renderCall = mockRender.mock.calls[0][0];
    const strictModeChildren = renderCall.props.children;
    const chakraProviderChildren = strictModeChildren.props.children;
    
    // Verify App component is rendered
    expect(chakraProviderChildren.type).toBe(MockApp);
  });

  it('should call createRoot with null when root element is missing', async () => {
    // Arrange: Mock getElementById to return null
    document.getElementById = vi.fn(() => null);
    vi.resetModules();

    // Act: Import main.tsx
    await import('../main');

    // Assert: createRoot should be called with null
    // Note: The non-null assertion (!) is a TypeScript compile-time check,
    // but at runtime, null will be passed to createRoot
    expect(mockCreateRoot).toHaveBeenCalledTimes(1);
    expect(mockCreateRoot).toHaveBeenCalledWith(null);
  });

  it('should configure theme with correct Toast position', async () => {
    // Arrange
    await import('../main');

    // Assert
    const renderCall = mockRender.mock.calls[0][0];
    const theme = renderCall.props.children.props.theme;
    
    expect(theme.components.Toast.defaultProps.position).toBe('top-right');
  });

  it('should configure theme with light mode as initial color mode', async () => {
    // Arrange
    await import('../main');

    // Assert
    const renderCall = mockRender.mock.calls[0][0];
    const theme = renderCall.props.children.props.theme;
    
    expect(theme.config.initialColorMode).toBe('light');
    expect(theme.config.useSystemColorMode).toBe(false);
  });

  it('should render complete component hierarchy correctly', async () => {
    // Arrange
    await import('../main');

    // Assert: Verify the complete hierarchy
    expect(mockRender).toHaveBeenCalledTimes(1);
    
    const renderCall = mockRender.mock.calls[0][0];
    
    // Level 1: StrictMode
    expect(renderCall.type).toBe(React.StrictMode);
    
    // Level 2: ChakraProvider
    const chakraProvider = renderCall.props.children;
    expect(chakraProvider.type).toBe(ChakraProvider);
    
    // Level 3: App
    const app = chakraProvider.props.children;
    expect(app.type).toBe(MockApp);
  });

  it('should configure theme with all required properties', async () => {
    // Arrange
    await import('../main');

    // Assert
    const renderCall = mockRender.mock.calls[0][0];
    const theme = renderCall.props.children.props.theme;
    
    // Verify all theme properties are present
    expect(theme).toHaveProperty('config');
    expect(theme).toHaveProperty('components');
    expect(theme.config).toHaveProperty('initialColorMode');
    expect(theme.config).toHaveProperty('useSystemColorMode');
    expect(theme.components).toHaveProperty('Toast');
    expect(theme.components.Toast).toHaveProperty('defaultProps');
    expect(theme.components.Toast.defaultProps).toHaveProperty('position');
  });
});

