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
    const item = await client
      .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`)
      .get();

    return item as SharePointItem;
  } catch (error) {
    console.error('Error fetching SharePoint item:', error);
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
 */
export function generateSharePointUrl(
  siteId: string,
  driveId: string,
  itemId: string
): string {
  // Construct SharePoint URL
  // This is a simplified version - in production, you might need the actual site URL
  return `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}`;
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

