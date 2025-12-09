declare module 'sanitize-html' {
  export interface IOptions {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    disallowedTagsMode?: 'discard' | 'escape';
  }

  function sanitizeHtml(html: string, options?: IOptions): string;
  export default sanitizeHtml;
}


