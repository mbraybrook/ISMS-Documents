import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML input to prevent XSS attacks in the frontend
 * @param input HTML string to sanitize
 * @returns Sanitized HTML string safe for innerHTML
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a',
    ],
    ALLOWED_ATTR: ['href', 'title', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
}

/**
 * Sanitizes plain text by removing HTML tags
 * @param input Text string that may contain HTML
 * @returns Plain text with HTML removed
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Remove all HTML tags using DOMPurify
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Sanitizes user input for display in React components
 * Use this when rendering user-generated content
 * @param input User input string
 * @returns Sanitized string safe for rendering
 */
export function sanitizeForDisplay(input: string | null | undefined): string {
  return sanitizeText(input);
}


