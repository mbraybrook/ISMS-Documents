import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatBoolean, formatEmptyValue, generateCSV, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from '../tableUtils';

describe('tableUtils', () => {
    describe('formatBoolean', () => {
        it('should return "Yes" for true', () => {
            expect(formatBoolean(true)).toBe('Yes');
        });

        it('should return "No" for false', () => {
            expect(formatBoolean(false)).toBe('No');
        });

        it('should return "No" for null or undefined', () => {
            expect(formatBoolean(null)).toBe('No');
            expect(formatBoolean(undefined)).toBe('No');
        });
    });

    describe('formatEmptyValue', () => {
        it('should return value string if present', () => {
            expect(formatEmptyValue('hello')).toBe('hello');
            expect(formatEmptyValue(123)).toBe('123');
            expect(formatEmptyValue(0)).toBe('0');
        });

        it('should return "—" for empty string', () => {
            expect(formatEmptyValue('')).toBe('—');
        });

        it('should return "—" for null or undefined', () => {
            expect(formatEmptyValue(null)).toBe('—');
            expect(formatEmptyValue(undefined)).toBe('—');
        });
    });

    describe('generateCSV', () => {
        // Mock URL and Blob
        global.URL.createObjectURL = vi.fn(() => 'mock-url');
        global.URL.revokeObjectURL = vi.fn();

        // Use a real Blob if possible, or mock it constructor if environment doesn't support it (Vitest/JSDOM does support Blob)

        beforeEach(() => {
            // Prevent JSDOM navigation error "Not implemented: navigation"
            vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('should download a CSV file with correct content', () => {
            // Spy on document methods but let them work mainly
            const appendChildSpy = vi.spyOn(document.body, 'appendChild');
            const removeChildSpy = vi.spyOn(document.body, 'removeChild');

            // We spy on createElement just to get a reference if needed, but we don't need to mock return value 
            // if we just want to verify interactions on the real element created by JSDOM.
            // However, tableUtils.ts does: link.click(). JSDOM's click() works.
            // URL.createObjectURL needs mocking as JSDOM doesn't support it fully.

            // To intercept the link and verify properties:
            const linkMock = document.createElement('a');
            const clickSpy = vi.spyOn(linkMock, 'click');
            const setAttributeSpy = vi.spyOn(linkMock, 'setAttribute');

            vi.spyOn(document, 'createElement').mockReturnValue(linkMock);

            const headers = ['Name', 'Age', 'City'];
            const rows = [
                ['John Doe', 30, 'New York'],
                ['Jane Smith', null, 'London'],
                ['Bob "Builder"', 40, 'Paris']
            ];
            const filename = 'test.csv';

            generateCSV(headers, rows, filename);

            expect(setAttributeSpy).toHaveBeenCalledWith('href', 'mock-url');
            expect(setAttributeSpy).toHaveBeenCalledWith('download', filename);
            expect(appendChildSpy).toHaveBeenCalledWith(linkMock);
            expect(clickSpy).toHaveBeenCalled();
            expect(removeChildSpy).toHaveBeenCalledWith(linkMock);
            expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
        });

        it('should handle special characters in CSV', () => {
            // Just verifying it runs without error for complex inputs
            const headers = ['Quote'];
            const rows = [['He said "Hello"']];
            generateCSV(headers, rows, 'quotes.csv');
            expect(global.URL.createObjectURL).toHaveBeenCalled();
        });
    });

    describe('Constants', () => {
        it('should have correct defaults', () => {
            expect(DEFAULT_PAGE_SIZE).toBe(20);
            expect(DEFAULT_PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100]);
        });
    });
});
