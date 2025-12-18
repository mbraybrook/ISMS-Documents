import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../Layout';
import { ChakraProvider } from '@chakra-ui/react';

// Mock useAuth
const mockGetEffectiveRole = vi.fn();
const mockUser = {
    id: '1',
    displayName: 'Test User',
    email: 'test@example.com',
    role: 'ADMIN'
};

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual, // Preserves AuthProvider export
    useAuth: () => ({
      user: mockUser,
      getEffectiveRole: mockGetEffectiveRole,
    }),
  };
});

// Mock api
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { pagination: { total: 5 } } }),
    },
}));

describe('Layout Navigation', () => {
    it('renders the new navigation structure for ADMIN', async () => {
        mockGetEffectiveRole.mockReturnValue('ADMIN');

        render(
            <ChakraProvider>
                <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <Layout>
                        <div>Content</div>
                    </Layout>
                </MemoryRouter>
            </ChakraProvider>
        );

        // Check for top-level menus
        expect(screen.getByText('Documents')).toBeInTheDocument();
        expect(screen.getByText('Risk Management')).toBeInTheDocument();
        expect(screen.getByText('Organization')).toBeInTheDocument();
        expect(screen.getByText('System')).toBeInTheDocument();

        // Check for specific items in Documents
        act(() => {
            fireEvent.click(screen.getByText('Documents'));
        });
        // Use findByText to wait for the menu to open (async animation)
        expect(await screen.findByText('Library')).toBeInTheDocument();
        expect(await screen.findByText('Acknowledgments')).toBeInTheDocument();
        expect(await screen.findByText('Reviews')).toBeInTheDocument();

        // Check for specific items in Risk Management
        act(() => {
            fireEvent.click(screen.getByText('Risk Management'));
        });
        expect(await screen.findByText('Risk Register')).toBeInTheDocument();
        expect(await screen.findByText('Review Inbox')).toBeInTheDocument();
        expect(await screen.findByText('Controls')).toBeInTheDocument();
        expect(await screen.findByText('Statement of Applicability')).toBeInTheDocument();

        // Check for specific items in Organization
        act(() => {
            fireEvent.click(screen.getByText('Organization'));
        });
        expect(await screen.findByText('Assets')).toBeInTheDocument();
        expect(await screen.findByText('Asset Categories')).toBeInTheDocument();
        expect(await screen.findByText('Suppliers')).toBeInTheDocument();
        expect(await screen.findByText('Interested Parties')).toBeInTheDocument();
        expect(await screen.findByText('Legislation')).toBeInTheDocument();

        // Check for specific items in System
        act(() => {
            fireEvent.click(screen.getByText('System'));
        });
        expect(await screen.findByText('Trust Centre')).toBeInTheDocument();
        expect(await screen.findByText('User Management')).toBeInTheDocument();
    }, 15000);
});
