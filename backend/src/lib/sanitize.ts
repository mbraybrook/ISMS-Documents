import sanitizeHtml from 'sanitize-html';

/**
 * Configuration for HTML sanitization
 * Allows safe HTML tags and attributes while removing potentially dangerous content
 */
const sanitizeOptions: {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  allowedSchemes?: string[];
  disallowedTagsMode?: 'discard' | 'escape';
} = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    '*': ['class'], // Allow class attribute on all tags
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Remove all script tags and event handlers
  disallowedTagsMode: 'discard',
};

/**
 * Sanitizes HTML input to prevent XSS attacks
 * @param input HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtmlInput(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return sanitizeHtml(input, sanitizeOptions);
}

/**
 * Sanitizes plain text input by removing HTML tags
 * @param input Text string that may contain HTML
 * @returns Plain text with HTML removed
 */
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Remove all HTML tags
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}

/**
 * Sanitizes an object's string properties recursively
 * Useful for sanitizing request bodies
 * @param obj Object to sanitize
 * @param fieldsToSanitize Array of field names to sanitize (if empty, sanitizes all string fields)
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fieldsToSanitize: string[] = []
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = { ...obj } as any;
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      // If fieldsToSanitize is specified, only sanitize those fields
      // Otherwise, sanitize all string fields
      if (fieldsToSanitize.length === 0 || fieldsToSanitize.includes(key)) {
        sanitized[key] = sanitizeTextInput(value);
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, fieldsToSanitize);
    } else if (Array.isArray(value)) {
      // Sanitize array elements
      sanitized[key] = value.map((item) => {
        if (typeof item === 'string') {
          return sanitizeTextInput(item);
        } else if (item && typeof item === 'object') {
          return sanitizeObject(item, fieldsToSanitize);
        }
        return item;
      });
    }
  }

  return sanitized as T;
}


