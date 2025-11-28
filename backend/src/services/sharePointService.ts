import { Client } from '@microsoft/microsoft-graph-client';
import { config } from '../config';

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

