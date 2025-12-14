import {
  sanitizeHtmlInput,
  sanitizeTextInput,
  sanitizeObject,
} from '../sanitize';

describe('sanitize', () => {
  describe('sanitizeHtmlInput', () => {
    it('should return empty string when input is null', () => {
      // Arrange
      const input = null;

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toBe('');
    });

    it('should return empty string when input is undefined', () => {
      // Arrange
      const input = undefined;

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toBe('');
    });

    it('should return empty string when input is empty string', () => {
      // Arrange
      const input = '';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toBe('');
    });

    it('should return empty string when input is not a string', () => {
      // Arrange
      const input = 123 as unknown as string;

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toBe('');
    });

    it('should preserve allowed HTML tags', () => {
      // Arrange
      const input = '<p>Hello <strong>world</strong></p>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('world');
    });

    it('should preserve allowed HTML attributes', () => {
      // Arrange
      const input = '<a href="https://example.com" title="Link">Click me</a>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('title="Link"');
    });

    it('should preserve class attribute on all tags', () => {
      // Arrange
      const input = '<p class="my-class">Text</p>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toContain('class="my-class"');
    });

    it('should remove script tags', () => {
      // Arrange
      const input = '<p>Hello</p><script>alert("XSS")</script>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert("XSS")');
      expect(result).toContain('<p>Hello</p>');
    });

    it('should remove event handlers', () => {
      // Arrange
      const input = '<p onclick="alert(\'XSS\')">Click me</p>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).not.toContain('onclick');
      expect(result).toContain('<p>');
      expect(result).toContain('Click me');
    });

    it('should remove dangerous HTML tags', () => {
      // Arrange
      const input = '<iframe src="evil.com"></iframe><p>Safe</p>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).not.toContain('<iframe>');
      expect(result).toContain('<p>Safe</p>');
    });

    it('should allow http and https schemes in links', () => {
      // Arrange
      const input = '<a href="https://example.com">Link</a>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toContain('href="https://example.com"');
    });

    it('should allow mailto scheme in links', () => {
      // Arrange
      const input = '<a href="mailto:test@example.com">Email</a>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toContain('href="mailto:test@example.com"');
    });

    it('should remove javascript: scheme in links', () => {
      // Arrange
      const input = '<a href="javascript:alert(\'XSS\')">Click</a>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('alert');
    });

    it('should preserve multiple allowed tags', () => {
      // Arrange
      const input = '<h1>Title</h1><p>Paragraph</p><ul><li>Item</li></ul>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      expect(result).toContain('<h1>');
      expect(result).toContain('<p>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
    });

    it('should handle complex nested HTML', () => {
      // Arrange
      const input = '<div><p>Text <strong>bold</strong> and <em>italic</em></p></div>';

      // Act
      const result = sanitizeHtmlInput(input);

      // Assert
      // Note: div is not in allowedTags, so it will be removed
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });
  });

  describe('sanitizeTextInput', () => {
    it('should return empty string when input is null', () => {
      // Arrange
      const input = null;

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('');
    });

    it('should return empty string when input is undefined', () => {
      // Arrange
      const input = undefined;

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('');
    });

    it('should return empty string when input is empty string', () => {
      // Arrange
      const input = '';

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('');
    });

    it('should return empty string when input is not a string', () => {
      // Arrange
      const input = 123 as unknown as string;

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('');
    });

    it('should remove all HTML tags from plain text', () => {
      // Arrange
      const input = '<p>Hello <strong>world</strong></p>';

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('Hello world');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should remove script tags and their content', () => {
      // Arrange
      const input = 'Hello<script>alert("XSS")</script>World';

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('HelloWorld');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should preserve plain text content', () => {
      // Arrange
      const input = 'This is plain text with no HTML';

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('This is plain text with no HTML');
    });

    it('should remove all HTML attributes', () => {
      // Arrange
      const input = '<a href="https://example.com">Link</a>';

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('Link');
      expect(result).not.toContain('href');
    });

    it('should handle nested HTML tags', () => {
      // Arrange
      const input = '<div><p><strong>Bold</strong> text</p></div>';

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('Bold text');
    });

    it('should handle multiple HTML tags', () => {
      // Arrange
      const input = '<h1>Title</h1><p>Paragraph</p><ul><li>Item</li></ul>';

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toBe('TitleParagraphItem');
    });

    it('should handle special characters in text', () => {
      // Arrange
      const input = '<p>Text with &amp; &lt; &gt; symbols</p>';

      // Act
      const result = sanitizeTextInput(input);

      // Assert
      expect(result).toContain('Text with');
      expect(result).not.toContain('<p>');
    });
  });

  describe('sanitizeObject', () => {
    it('should return the same value when input is not an object', () => {
      // Arrange
      const input = 'string' as unknown as Record<string, unknown>;

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result).toBe('string');
    });

    it('should return the same value when input is null', () => {
      // Arrange
      const input = null as unknown as Record<string, unknown>;

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result).toBeNull();
    });

    it('should return the same value when input is undefined', () => {
      // Arrange
      const input = undefined as unknown as Record<string, unknown>;

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return the same value when input is a number', () => {
      // Arrange
      const input = 123 as unknown as Record<string, unknown>;

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result).toBe(123);
    });

    it('should sanitize all string fields when fieldsToSanitize is empty', () => {
      // Arrange
      const input = {
        name: '<p>John</p>',
        email: '<script>alert("XSS")</script>test@example.com',
        age: 30,
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.name).toBe('John');
      expect(result.email).toBe('test@example.com');
      expect(result.age).toBe(30);
    });

    it('should sanitize only specified fields when fieldsToSanitize is provided', () => {
      // Arrange
      const input = {
        name: '<p>John</p>',
        description: '<script>alert("XSS")</script>Description',
        title: '<strong>Title</strong>',
      };

      // Act
      const result = sanitizeObject(input, ['name', 'description']);

      // Assert
      expect(result.name).toBe('John');
      expect(result.description).toBe('Description');
      expect(result.title).toBe('<strong>Title</strong>'); // Not sanitized
    });

    it('should sanitize nested objects recursively', () => {
      // Arrange
      const input = {
        user: {
          name: '<p>John</p>',
          profile: {
            bio: '<script>alert("XSS")</script>Bio',
          },
        },
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.user.name).toBe('John');
      expect(result.user.profile.bio).toBe('Bio');
    });

    it('should sanitize nested objects with fieldsToSanitize', () => {
      // Arrange
      const input = {
        user: {
          name: '<p>John</p>',
          email: '<script>alert("XSS")</script>test@example.com',
        },
      };

      // Act
      const result = sanitizeObject(input, ['name']);

      // Assert
      expect(result.user.name).toBe('John');
      expect(result.user.email).toBe('<script>alert("XSS")</script>test@example.com'); // Not sanitized
    });

    it('should sanitize array of strings', () => {
      // Arrange
      const input = {
        tags: ['<p>tag1</p>', '<script>alert("XSS")</script>tag2', 'tag3'],
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should sanitize array of objects', () => {
      // Arrange
      const input = {
        items: [
          { name: '<p>Item 1</p>', value: 10 },
          { name: '<script>alert("XSS")</script>Item 2', value: 20 },
        ],
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].name).toBe('Item 2');
      expect(result.items[0].value).toBe(10);
      expect(result.items[1].value).toBe(20);
    });

    it('should sanitize nested arrays', () => {
      // Arrange
      const input = {
        matrix: [
          ['<p>a</p>', '<script>alert("XSS")</script>b'],
          ['<strong>c</strong>', 'd'],
        ],
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.matrix[0][0]).toBe('a');
      expect(result.matrix[0][1]).toBe('b');
      expect(result.matrix[1][0]).toBe('c');
      expect(result.matrix[1][1]).toBe('d');
    });

    it('should handle empty object', () => {
      // Arrange
      const input = {};

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result).toEqual({});
    });

    it('should handle object with no string fields', () => {
      // Arrange
      const input = {
        number: 123,
        boolean: true,
        nullValue: null,
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result).toEqual(input);
    });

    it('should handle array with mixed types', () => {
      // Arrange
      const input = {
        mixed: [
          '<p>string</p>',
          123,
          { name: '<script>alert("XSS")</script>John' },
          null,
          true,
        ],
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.mixed[0]).toBe('string');
      expect(result.mixed[1]).toBe(123);
      expect((result.mixed[2] as { name: string }).name).toBe('John');
      expect(result.mixed[3]).toBeNull();
      expect(result.mixed[4]).toBe(true);
    });

    it('should handle deeply nested structures', () => {
      // Arrange
      const input = {
        level1: {
          level2: {
            level3: {
              text: '<p>Deep text</p>',
              items: ['<script>alert("XSS")</script>item1', 'item2'],
            },
          },
        },
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.level1.level2.level3.text).toBe('Deep text');
      expect(result.level1.level2.level3.items).toEqual(['item1', 'item2']);
    });

    it('should preserve non-string array elements', () => {
      // Arrange
      const input = {
        data: [1, 2, 3, '<p>four</p>', 5],
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.data[0]).toBe(1);
      expect(result.data[1]).toBe(2);
      expect(result.data[2]).toBe(3);
      expect(result.data[3]).toBe('four');
      expect(result.data[4]).toBe(5);
    });

    it('should handle array with null and undefined elements', () => {
      // Arrange
      const input = {
        items: ['<p>text</p>', null, undefined, 123],
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.items[0]).toBe('text');
      expect(result.items[1]).toBeNull();
      expect(result.items[2]).toBeUndefined();
      expect(result.items[3]).toBe(123);
    });

    it('should not modify the original object', () => {
      // Arrange
      const input = {
        name: '<p>John</p>',
        email: 'test@example.com',
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(input.name).toBe('<p>John</p>');
      expect(result.name).toBe('John');
    });

    it('should handle object with fieldsToSanitize containing non-existent fields', () => {
      // Arrange
      const input = {
        name: '<p>John</p>',
        email: '<script>alert("XSS")</script>test@example.com',
      };

      // Act
      const result = sanitizeObject(input, ['name', 'nonexistent']);

      // Assert
      expect(result.name).toBe('John');
      expect(result.email).toBe('<script>alert("XSS")</script>test@example.com'); // Not sanitized
    });

    it('should handle empty array', () => {
      // Arrange
      const input = {
        items: [],
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.items).toEqual([]);
    });

    it('should handle array with empty objects', () => {
      // Arrange
      const input = {
        items: [{}, { name: '<p>John</p>' }, {}],
      };

      // Act
      const result = sanitizeObject(input);

      // Assert
      expect(result.items[0]).toEqual({});
      expect(result.items[1].name).toBe('John');
      expect(result.items[2]).toEqual({});
    });
  });
});

