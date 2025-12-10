import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeText, sanitizeForDisplay } from '../sanitize';

describe('sanitize utils', () => {
    describe('sanitizeHtml', () => {
        it('should return empty string for null or undefined input', () => {
            expect(sanitizeHtml(null)).toBe('');
            expect(sanitizeHtml(undefined)).toBe('');
        });

        it('should allow safe HTML tags', () => {
            const input = '<p><strong>Bold</strong> and <em>Italic</em></p>';
            expect(sanitizeHtml(input)).toBe(input);
        });

        it('should remove unsafe tags (script)', () => {
            const input = '<p>Safe <script>alert("xss")</script></p>';
            const expected = '<p>Safe </p>';
            expect(sanitizeHtml(input)).toBe(expected);
        });

        it('should remove unsafe tags (iframe)', () => {
            const input = '<div><iframe src="javascript:alert(1)"></iframe></div>';
            // div is not in the allowed list in sanitize.ts, so it might be stripped too depending on implementation
            // Looking at sanitize.ts ALLOWED_TAGS: p, br, strong, em, u, h1-h6, ul, ol, li, blockquote, code, pre, a
            // div is NOT in allowed tags.
            const expected = '';
            expect(sanitizeHtml(input)).toBe(expected);
        });

        it('should allow allowed attributes', () => {
            const input = '<a href="https://example.com" title="Example" class="link">Link</a>';
            expect(sanitizeHtml(input)).toBe(input);
        });

        it('should strip disallowed attributes', () => {
            const input = '<p onclick="alert(1)">Click me</p>';
            const expected = '<p>Click me</p>';
            expect(sanitizeHtml(input)).toBe(expected);
        });

        it('should sanitize javascript: links', () => {
            const input = '<a href="javascript:alert(1)">Link</a>';
            // DOMPurify usually strips the href content or the attribute content for javascript:
            // The regex in sanitize.ts: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
            // This regex enforces http/https/mailto.
            // If it fails regex, DOMPurify likely strips it.
            const result = sanitizeHtml(input);
            expect(result).not.toContain('javascript:');
        });
    });

    describe('sanitizeText', () => {
        it('should return empty string for null or undefined input', () => {
            expect(sanitizeText(null)).toBe('');
            expect(sanitizeText(undefined)).toBe('');
        });

        it('should strip all HTML tags', () => {
            const input = '<p>Hello <strong>World</strong></p>';
            expect(sanitizeText(input)).toBe('Hello World');
        });

        it('should handle strings without HTML', () => {
            const input = 'Plain text';
            expect(sanitizeText(input)).toBe('Plain text');
        });
    });

    describe('sanitizeForDisplay', () => {
        it('should alias sanitizeText', () => {
            const input = '<b>Bold</b>';
            expect(sanitizeForDisplay(input)).toBe('Bold');
        });
    });
});
