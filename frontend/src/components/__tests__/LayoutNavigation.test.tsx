import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
        getEffectiveRole: mockGetEffectiveRole,
    }),
}));

// Mock api
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { pagination: { total: 5 } } }),
    },
}));

describe('Layout Navigation', () => {
    it('renders the new navigation structure for ADMIN', () => {
        mockGetEffectiveRole.mockReturnValue('ADMIN');

        render(
            <ChakraProvider>
                <MemoryRouter>
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
        fireEvent.click(screen.getByText('Documents'));
        expect(screen.getByText('Library')).toBeInTheDocument();
        expect(screen.getByText('Acknowledgments')).toBeInTheDocument();
        expect(screen.getByText('Reviews')).toBeInTheDocument();

        // Check for specific items in Risk Management
        fireEvent.click(screen.getByText('Risk Management'));
        expect(screen.getByText('Risk Register')).toBeInTheDocument();
        expect(screen.getByText('Review Inbox')).toBeInTheDocument();
        expect(screen.getByText('Controls')).toBeInTheDocument();
        expect(screen.getByText('Statement of Applicability')).toBeInTheDocument();

        // Check for specific items in Organization
        fireEvent.click(screen.getByText('Organization'));
        expect(screen.getByText('Assets')).toBeInTheDocument();
        expect(screen.getByText('Asset Categories')).toBeInTheDocument();
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
        expect(screen.getByText('Interested Parties')).toBeInTheDocument();
        expect(screen.getByText('Legislation')).toBeInTheDocument();

        // Check for specific items in System
        fireEvent.click(screen.getByText('System'));
        expect(screen.getByText('Trust Center')).toBeInTheDocument();
        expect(screen.getByText('User Management')).toBeInTheDocument();
    });
});
