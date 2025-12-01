import { config } from '../config';
import axios, { AxiosInstance } from 'axios';

/**
 * Create Confluence API client
 */
function createConfluenceClient(): AxiosInstance {
  const { baseUrl, username, apiToken } = config.confluence;

  if (!baseUrl || !username || !apiToken) {
    throw new Error('Confluence configuration is missing');
  }

  const auth = Buffer.from(`${username}:${apiToken}`).toString('base64');

  return axios.create({
    baseURL: `${baseUrl}/rest/api`,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
}

export interface ConfluencePage {
  id: string;
  title: string;
  space: {
    key: string;
    name: string;
  };
  version: {
    number: number;
  };
  _links: {
    webui: string;
    self: string;
  };
  body?: {
    storage?: {
      value: string;
    };
  };
}

/**
 * Get Confluence page by ID
 */
export async function getConfluencePage(
  spaceKey: string,
  pageId: string
): Promise<ConfluencePage | null> {
  try {
    const client = createConfluenceClient();
    const response = await client.get(`/content/${pageId}`, {
      params: {
        expand: 'space,version,body.storage',
      },
    });

    return response.data as ConfluencePage;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error('Error fetching Confluence page:', error);
    return null;
  }
}

/**
 * Search for Confluence pages in a space
 */
export async function searchConfluencePages(
  spaceKey: string,
  query?: string
): Promise<ConfluencePage[]> {
  try {
    const client = createConfluenceClient();
    const params: any = {
      spaceKey,
      expand: 'space,version',
      limit: 100,
    };

    if (query) {
      params.cql = `space = ${spaceKey} AND text ~ "${query}"`;
    }

    const response = await client.get('/content/search', { params });
    return (response.data.results || []) as ConfluencePage[];
  } catch (error) {
    console.error('Error searching Confluence pages:', error);
    return [];
  }
}

/**
 * List all pages in a Confluence space
 */
export async function listConfluencePages(
  spaceKey: string
): Promise<ConfluencePage[]> {
  try {
    const client = createConfluenceClient();
    const response = await client.get(`/content`, {
      params: {
        spaceKey,
        expand: 'space,version',
        limit: 100,
      },
    });

    return (response.data.results || []) as ConfluencePage[];
  } catch (error) {
    console.error('Error listing Confluence pages:', error);
    return [];
  }
}

/**
 * Generate Confluence URL for a page
 */
export function generateConfluenceUrl(
  baseUrl: string,
  spaceKey: string,
  pageId: string
): string {
  return `${baseUrl}/pages/viewpage.action?pageId=${pageId}`;
}

/**
 * Get Confluence space information
 */
export async function getConfluenceSpace(spaceKey: string): Promise<any> {
  try {
    const client = createConfluenceClient();
    const response = await client.get(`/space/${spaceKey}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Confluence space:', error);
    return null;
  }
}



