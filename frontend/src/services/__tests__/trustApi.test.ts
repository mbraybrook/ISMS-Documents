/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { trustApi } from '../trustApi';
import apiInternal from '../api';

// Mock axios and api internal
vi.mock('axios', () => {
    const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        interceptors: {
            request: { use: vi.fn(), eject: vi.fn() },
            response: { use: vi.fn(), eject: vi.fn() },
        },
    };

    return {
        default: {
            create: vi.fn(() => mockAxiosInstance),
            post: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        },
    };
});

vi.mock('../api', () => ({
    __esModule: true,
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

// Setup localStorage mock
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value.toString();
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Access mocks for assertions
const mockedAxios = axios as unknown as {
    create: any;
    get: any;
    post: any;
    interceptors: any;
};
const mockedApiInternal = apiInternal as unknown as {
    get: any;
    post: any;
    put: any;
    delete: any;
};

describe('trustApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        // Default mock response for axios.post
        mockedAxios.post.mockResolvedValue({});
    });

    describe('Authentication', () => {
        it('login should store token on success', async () => {
            const mockResponse = { data: { token: 'fake-jwt-token', user: { id: '1', email: 'test@example.com' } } };
            mockedAxios.post.mockResolvedValueOnce(mockResponse);

            const result = await trustApi.login('test@example.com', 'password');

            expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/login'), {
                email: 'test@example.com',
                password: 'password',
            });
            expect(localStorageMock.setItem).toHaveBeenCalledWith('trust_token', 'fake-jwt-token');
            expect(result).toEqual(mockResponse.data);
        });

        it('logout should clear token', () => {
            trustApi.logout();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('trust_token');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('trust_token_exp');
        });

        it('register should call register endpoint', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: { id: '1', email: 'test@example.com' } });
            await trustApi.register('test@example.com', 'password', 'Company');
            expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/register'), expect.any(Object));
        });
    });

    describe('Documents', () => {
        it('getDocuments should call correct endpoint', async () => {
            mockedAxios.get.mockResolvedValueOnce({ data: [] });
            await trustApi.getDocuments();
            expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/documents'), expect.any(Object));
        });

        it('downloadDocument should download file', async () => {
            const mockBlob = new Blob(['test'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValueOnce({
                data: mockBlob,
                headers: { 'content-type': 'application/pdf' },
                status: 200
            });

            const result = await trustApi.downloadDocument('doc-1');
            expect(result.blob).toBeInstanceOf(Blob);
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('/download/doc-1'),
                expect.objectContaining({ responseType: 'blob' })
            );
        });
    });

    describe('Admin Functions', () => {
        it('getPendingRequests should use apiInternal', async () => {
            mockedApiInternal.get.mockResolvedValueOnce({ data: [] });
            await trustApi.getPendingRequests();
            expect(mockedApiInternal.get).toHaveBeenCalledWith('/api/trust/admin/pending-requests');
        });

        it('approveUser should use apiInternal', async () => {
            mockedApiInternal.post.mockResolvedValueOnce({ data: {} });
            await trustApi.approveUser('user-1');
            expect(mockedApiInternal.post).toHaveBeenCalledWith('/api/trust/admin/approve-user/user-1');
        });
    });

    describe('Token Helpers', () => {
        it('getToken should retrieve from localStorage', () => {
            localStorageMock.getItem.mockReturnValueOnce('stored-token');
            expect(trustApi.getToken()).toBe('stored-token');
        });
    });
});
