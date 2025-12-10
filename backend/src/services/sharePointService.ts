/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { config } from '../config';

// Token cache for app-only authentication
let cachedAppToken: { token: string; expiresAt: number } | null = null;

/**
 * Create Microsoft Graph client with access token
 */
function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export interface SharePointItem {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
  createdDateTime: string;
  size: number;
  siteId?: string; // Added to track which site the item belongs to
  driveId?: string; // Added to track which drive the item belongs to
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
    };
  };
  createdBy?: {
    user: {
      displayName: string;
      email: string;
    };
  };
  lastModifiedBy?: {
    user: {
      displayName: string;
      email: string;
    };
  };
}

/**
 * Get SharePoint item metadata by site, drive, and item ID
 */
export async function getSharePointItem(
  accessToken: string,
  siteId: string,
  driveId: string,
  itemId: string
): Promise<SharePointItem | null> {
  try {
    const client = createGraphClient(accessToken);
    const apiPath = `/sites/${siteId}/drives/${driveId}/items/${itemId}`;
    console.log('[SharePointService] Fetching item from Graph API', { apiPath, itemId });
    
    const item = await client.api(apiPath).get();

    console.log('[SharePointService] Successfully fetched item', {
      itemId,
      hasWebUrl: !!(item as any)?.webUrl,
      name: (item as any)?.name,
    });

    return item as SharePointItem;
  } catch (error: any) {
    console.error('[SharePointService] Error fetching SharePoint item:', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      status: error.status,
      body: error.body,
      itemId,
      siteId,
      driveId,
    });
    return null;
  }
}

/**
 * List items in a SharePoint drive
 */
export async function listSharePointItems(
  accessToken: string,
  siteId: string,
  driveId: string,
  folderPath?: string,
  folderId?: string
): Promise<SharePointItem[]> {
  try {
    const client = createGraphClient(accessToken);
    let apiPath: string;

    if (folderId) {
      // Use folder ID directly
      apiPath = `/sites/${siteId}/drives/${driveId}/items/${folderId}/children`;
    } else if (folderPath) {
      // Get folder by path and then list children
      const folder = await client
        .api(`/sites/${siteId}/drives/${driveId}/root:/${folderPath}`)
        .get();
      apiPath = `/sites/${siteId}/drives/${driveId}/items/${folder.id}/children`;
    } else {
      // List root items
      apiPath = `/sites/${siteId}/drives/${driveId}/items/root/children`;
    }

    const response = await client.api(apiPath).get();
    return (response.value || []) as SharePointItem[];
  } catch (error) {
    console.error('Error listing SharePoint items:', error);
    return [];
  }
}

/**
 * Generate SharePoint URL for an item
 * If accessToken is provided, attempts to fetch the actual webUrl from SharePoint
 * Otherwise returns null (cannot generate a valid web URL without access token)
 */
export async function generateSharePointUrl(
  siteId: string,
  driveId: string,
  itemId: string,
  accessToken?: string
): Promise<string | null> {
  // If we have an access token, try to get the actual webUrl
  if (accessToken) {
    try {
      // First, try to get the item directly (fastest)
      const item = await getSharePointItem(accessToken, siteId, driveId, itemId);
      if (item?.webUrl) {
        return item.webUrl;
      }

      // If item doesn't have webUrl, try to get it from the site and construct the URL
      const site = await getSharePointSite(accessToken, siteId);
      if (site?.webUrl) {
        // Try to get the item path from the drive
        try {
          const client = createGraphClient(accessToken);
          const itemResponse = await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}?$select=webUrl`)
            .get();
          
          if (itemResponse.webUrl) {
            return itemResponse.webUrl;
          }
        } catch (itemError) {
          console.warn('Could not fetch item webUrl, attempting to construct from site URL:', itemError);
        }

        // Last resort: construct URL from site webUrl and item name
        // This is not ideal but better than returning a Graph API URL
        try {
          const item = await getSharePointItem(accessToken, siteId, driveId, itemId);
          if (item?.name) {
            // This is a fallback - the actual webUrl from the item is preferred
            console.warn('Using constructed URL as fallback - may not be accurate');
            return `${site.webUrl}/_layouts/15/Doc.aspx?sourcedoc=${itemId}`;
          }
        } catch (error) {
          console.error('Error constructing fallback URL:', error);
        }
      }
    } catch (error) {
      console.error('Error generating SharePoint URL with access token:', error);
    }
  }

  // Without access token, we cannot generate a valid web URL
  // Return null instead of a Graph API URL that won't work in a browser
  return null;
}

/**
 * Get SharePoint site information
 */
export async function getSharePointSite(
  accessToken: string,
  siteId: string
): Promise<any> {
  try {
    const client = createGraphClient(accessToken);
    const site = await client.api(`/sites/${siteId}`).get();
    return site;
  } catch (error) {
    console.error('Error fetching SharePoint site:', error);
    return null;
  }
}

/**
 * Get default drive (document library) for a SharePoint site
 */
export async function getDefaultDrive(
  accessToken: string,
  siteId: string
): Promise<any> {
  try {
    const client = createGraphClient(accessToken);
    const drives = await client.api(`/sites/${siteId}/drives`).get();
    // Return the first drive (usually the default document library)
    if (drives.value && drives.value.length > 0) {
      return drives.value[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching default drive:', error);
    return null;
  }
}

/**
 * List all drives (document libraries) for a SharePoint site
 */
export async function listDrives(
  accessToken: string,
  siteId: string
): Promise<any[]> {
  try {
    const client = createGraphClient(accessToken);
    const response = await client.api(`/sites/${siteId}/drives`).get();
    return response.value || [];
  } catch (error) {
    console.error('Error listing drives:', error);
    return [];
  }
}

/**
 * List all SharePoint sites the user has access to
 */
export async function listUserSites(accessToken: string): Promise<any[]> {
  try {
    const client = createGraphClient(accessToken);
    // Use search to get all sites the user has access to
    const response = await client.api('/sites?search=*').get();
    return response.value || [];
  } catch (error: any) {
    console.error('Error listing user sites:', error);
    // If search fails, try without search parameter
    try {
      const client = createGraphClient(accessToken);
      const response = await client.api('/sites').get();
      return response.value || [];
    } catch (fallbackError) {
      console.error('Error listing user sites (fallback):', fallbackError);
      return [];
    }
  }
}

/**
 * Parse SharePoint web URL and extract Site ID, Drive ID, and Item ID
 * Supports various SharePoint URL formats:
 * - Direct file URLs: https://contoso.sharepoint.com/sites/SiteName/Shared%20Documents/file.docx
 * - Sharing links: https://contoso.sharepoint.com/:w:/g/...
 */
export interface ParsedSharePointUrl {
  siteId: string;
  driveId: string;
  itemId: string;
  name: string;
  webUrl: string;
}

export async function parseSharePointUrl(
  accessToken: string,
  url: string
): Promise<ParsedSharePointUrl | null> {
  try {
    const client = createGraphClient(accessToken);
    
    // Try using the /shares endpoint first (works with sharing URLs)
    // Encode the URL for the shares endpoint
    const encodedUrl = encodeURIComponent(url);
    
    try {
      const shareResponse = await client
        .api(`/shares/${encodedUrl}/driveItem`)
        .get();
      
      if (shareResponse.parentReference) {
        return {
          siteId: shareResponse.parentReference.siteId,
          driveId: shareResponse.parentReference.driveId,
          itemId: shareResponse.id,
          name: shareResponse.name,
          webUrl: shareResponse.webUrl,
        };
      }
    } catch (shareError) {
      // If shares endpoint fails, try parsing the URL directly
      console.log('Shares endpoint failed, trying direct URL parsing:', shareError);
    }
    
    // Alternative: Parse URL and use /sites endpoint
    // Extract hostname and server-relative path from URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = decodeURIComponent(urlObj.pathname);
    
    // Try to get the drive item using the path
    try {
      const driveItem = await client
        .api(`/sites/${hostname}:${pathname}:/driveItem`)
        .get();
      
      if (driveItem.parentReference) {
        return {
          siteId: driveItem.parentReference.siteId,
          driveId: driveItem.parentReference.driveId,
          itemId: driveItem.id,
          name: driveItem.name,
          webUrl: driveItem.webUrl,
        };
      }
    } catch (pathError) {
      console.log('Direct path parsing failed:', pathError);
    }
    
    // Last resort: Try to get site by hostname and search for the file
    // This is more complex and may not always work
    return null;
  } catch (error) {
    console.error('Error parsing SharePoint URL:', error);
    return null;
  }
}

/**
 * Get app-only access token for Microsoft Graph API
 * Uses Azure Client ID/Secret for authentication
 * Implements token caching to avoid unnecessary token requests
 */
export async function getAppOnlyAccessToken(): Promise<string | null> {
  try {
    // Check if we have a valid cached token
    if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 5 * 60 * 1000) {
      // Token is still valid for at least 5 more minutes
      return cachedAppToken.token;
    }

    if (!config.azure.appClientId || !config.azure.appClientSecret || !config.azure.tenantId) {
      console.error('[SharePointService] Azure app-only auth not configured');
      return null;
    }

    const credential = new ClientSecretCredential(
      config.azure.tenantId,
      config.azure.appClientId,
      config.azure.appClientSecret
    );

    // Request token with Graph API scope
    const tokenResponse = await credential.getToken(['https://graph.microsoft.com/.default']);

    if (!tokenResponse || !tokenResponse.token) {
      console.error('[SharePointService] Failed to get app-only token');
      return null;
    }

    // Cache the token (expires in ~60-90 minutes, cache for slightly less)
    const expiresIn = (tokenResponse.expiresOnTimestamp - Date.now()) / 1000;
    cachedAppToken = {
      token: tokenResponse.token,
      expiresAt: tokenResponse.expiresOnTimestamp,
    };

    console.log('[SharePointService] App-only token obtained and cached', {
      expiresIn: Math.round(expiresIn / 60),
    });

    return tokenResponse.token;
  } catch (error: any) {
    console.error('[SharePointService] Error getting app-only token:', error);
    return null;
  }
}

/**
 * Parse SharePoint URL and extract siteId, driveId, itemId
 * This is a wrapper around parseSharePointUrl that returns just the IDs
 */
export async function parseSharePointUrlToIds(
  url: string,
  accessToken?: string
): Promise<{ siteId: string; driveId: string; itemId: string } | null> {
  try {
    // Use provided token or get app-only token
    const token = accessToken || (await getAppOnlyAccessToken());
    if (!token) {
      console.error('[SharePointService] No access token available for URL parsing');
      return null;
    }

    const parsed = await parseSharePointUrl(token, url);
    if (!parsed) {
      return null;
    }

    return {
      siteId: parsed.siteId,
      driveId: parsed.driveId,
      itemId: parsed.itemId,
    };
  } catch (error) {
    console.error('[SharePointService] Error parsing SharePoint URL to IDs:', error);
    return null;
  }
}

/**
 * Custom error classes for SharePoint operations
 */
export class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

export class FileTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileTooLargeError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Download SharePoint file content
 * Works with both delegated (user) and app-only tokens
 */
export async function downloadSharePointFile(
  accessToken: string,
  siteId: string,
  driveId: string,
  itemId: string,
  maxSizeMB?: number
): Promise<{ buffer: Buffer; mimeType: string; name: string; size: number }> {
  try {
    const client = createGraphClient(accessToken);

    // First, get file metadata to check size
    const item = await client
      .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`)
      .get();

    const fileSize = item.size || 0;
    const maxSizeBytes = (maxSizeMB || 50) * 1024 * 1024;

    if (fileSize > maxSizeBytes) {
      throw new FileTooLargeError(
        `File size (${Math.round(fileSize / 1024 / 1024)}MB) exceeds maximum allowed size (${maxSizeMB || 50}MB)`
      );
    }

    // Download file content with retry logic
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await client
          .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}/content`)
          .responseType('arraybuffer' as any)
          .get();

        const buffer = Buffer.from(response);

        return {
          buffer,
          mimeType: item.file?.mimeType || 'application/octet-stream',
          name: item.name,
          size: fileSize,
        };
      } catch (error: any) {
        lastError = error;
        // Check if it's a transient error (5xx) and retry
        if (error.statusCode && error.statusCode >= 500 && attempt < 2) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.warn(
            `[SharePointService] Transient error on attempt ${attempt + 1}, retrying in ${delay}ms:`,
            error.message
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // For non-transient errors, throw immediately
        throw error;
      }
    }

    throw lastError;
  } catch (error: any) {
    // Handle specific error types
    if (error.statusCode === 404) {
      throw new FileNotFoundError('File not found in SharePoint');
    }
    if (error.statusCode === 403 || error.statusCode === 401) {
      throw new PermissionDeniedError('Permission denied to access file');
    }
    if (error instanceof FileTooLargeError || error instanceof FileNotFoundError || error instanceof PermissionDeniedError) {
      throw error;
    }
    // Generic error
    console.error('[SharePointService] Error downloading file:', error);
    throw new Error(`Failed to download file: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Verify if a SharePoint file exists and is accessible
 */
export async function verifySharePointFileAccess(
  accessToken: string,
  siteId: string,
  driveId: string,
  itemId: string
): Promise<boolean> {
  try {
    const client = createGraphClient(accessToken);
    await client.api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`).get();
    return true;
  } catch (error: any) {
    if (error.statusCode === 404 || error.statusCode === 403 || error.statusCode === 401) {
      return false;
    }
    // For other errors, log and return false
    console.error('[SharePointService] Error verifying file access:', error);
    return false;
  }
}

