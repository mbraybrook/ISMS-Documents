/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { Client } from '@microsoft/microsoft-graph-client';
import { prisma } from '../lib/prisma';
import { getAppOnlyAccessToken } from './sharePointService';

export interface EntraIdUser {
  id: string;
  email: string;
  displayName: string;
}

export interface GroupInfo {
  id: string;
  displayName: string;
}

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

/**
 * Get group details by ID
 */
export async function getGroupById(
  groupId: string,
  accessToken: string
): Promise<GroupInfo | null> {
  try {
    const client = createGraphClient(accessToken);
    const group = await client.api(`/groups/${groupId}`).get();

    // Log basic group info
    console.log(`[EntraIdService] Group: ${group.displayName} (${group.id})`);

    return {
      id: group.id,
      displayName: group.displayName || group.mailNickname || groupId,
    };
  } catch (error: any) {
    console.error('[EntraIdService] Error fetching group:', error);
    if (error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch all (transitive) members of a group with proper paging
 * Handles throttling and large groups
 */
export async function getAllStaffMembers(
  groupId: string,
  accessToken: string
): Promise<EntraIdUser[]> {
  const maxRetries = 5;
  const baseDelayMs = 1000;

  // Try different endpoints based on group type
  // For distribution groups and security groups, /members should work
  // For Unified groups, /transitiveMembers might be needed
  // Try both to be safe
  const endpointsToTry = [
    `/groups/${groupId}/members`, // Direct members (works for all group types)
    `/groups/${groupId}/transitiveMembers`, // Transitive (includes nested groups)
  ];

  for (const endpointBase of endpointsToTry) {
    const allMembers: EntraIdUser[] = [];
    let nextLink: string | undefined = undefined;
    let pageRetryCount = 0;
    
    try {
      do {
        try {
          const client = createGraphClient(accessToken);
          const endpoint: string = nextLink || endpointBase;
          
          let response;
          try {
            // For nextLink, use it directly; for initial call, request specific properties
            if (nextLink) {
              response = await client.api(endpoint).get();
            } else {
              // Request specific properties to ensure mail and userPrincipalName are included
              response = await client
                .api(endpoint)
                .select('id,mail,userPrincipalName,displayName,givenName,surname')
                .get();
            }
          } catch (apiError: any) {
            // Log detailed error for permission issues
            if (apiError.statusCode === 403) {
              console.error('[EntraIdService] Access denied (403). Token may not have GroupMember.Read.All permission.');
              throw new Error('Access denied. Token does not have GroupMember.Read.All permission. ' +
                'Please grant consent for this permission and try again.');
            }
            throw apiError;
          }

          const members = response.value || [];
          
          // Filter to only users (not nested groups) and extract user info
          // The transitiveMembers endpoint can return both users and groups
          for (const member of members) {
            // Check if it's a user (not a group or other directory object)
            const odataType = member['@odata.type'];
            const isUser = odataType === '#microsoft.graph.user' || 
                          (odataType === undefined && member.id);
            
            if (isUser && member.id) {
              // If email/userPrincipalName are null, try fetching user details individually
              let email = member.mail || member.userPrincipalName;
              let displayName = member.displayName;
              
              if (!email || !displayName) {
                try {
                  // Fetch full user details - this requires User.Read.All or User.ReadBasic.All
                  const userDetails = await client
                    .api(`/users/${member.id}`)
                    .select('id,mail,userPrincipalName,displayName,givenName,surname')
                    .get();
                  
                  email = email || userDetails.mail || userDetails.userPrincipalName;
                  displayName = displayName || userDetails.displayName || 
                               (userDetails.givenName && userDetails.surname 
                                 ? `${userDetails.givenName} ${userDetails.surname}`.trim()
                                 : userDetails.userPrincipalName || userDetails.mail || '');
                } catch (userError: any) {
                  // Continue with what we have - user details fetch failed
                }
              }
              
              // Only include if it has an email/userPrincipalName (is a user)
              if (email) {
                allMembers.push({
                  id: member.id,
                  email: email,
                  displayName: displayName || email || '',
                });
              }
            }
          }

          nextLink = response['@odata.nextLink'];
          pageRetryCount = 0; // Reset retry count on success
        } catch (error: any) {
          // Handle throttling (429 Too Many Requests)
          if (error.statusCode === 429) {
            pageRetryCount++;
            if (pageRetryCount > maxRetries) {
              console.error('[EntraIdService] Max retries exceeded for throttling');
              throw new Error('Too many retry attempts for throttled request');
            }

            // Get retry-after header or use exponential backoff
            const retryAfter = error.headers?.['retry-after']
              ? parseInt(error.headers['retry-after'], 10) * 1000
              : baseDelayMs * Math.pow(2, pageRetryCount);

            console.log(
              `[EntraIdService] Throttled, retrying after ${retryAfter}ms (attempt ${pageRetryCount}/${maxRetries})`
            );
            await new Promise((resolve) => setTimeout(resolve, retryAfter));
            continue;
          }

          // Handle other errors
          console.error('[EntraIdService] Error fetching group members:', error);
          throw error;
        }
      } while (nextLink);

      // If we got members from this endpoint, return them
      if (allMembers.length > 0) {
        return allMembers;
      }
      // Continue to next endpoint if no members found
    } catch (error: any) {
      // If this endpoint fails and it's not the last one, try the next
      if (endpointsToTry.indexOf(endpointBase) < endpointsToTry.length - 1) {
        continue;
      }
      // Last endpoint failed, throw error
      console.error('[EntraIdService] Failed to fetch all staff members:', error);
      throw error;
    }
  }

  // Tried all endpoints, still no members
  console.warn('[EntraIdService] No members found. Group may be empty or token lacks permissions.');
  return [];
}

/**
 * Sync all staff members from configured group to cache
 * Uses application token if available, falls back to delegated token
 */
export async function syncAllStaffMembersToCache(
  groupId: string,
  accessToken?: string
): Promise<number> {
  try {
    // Prefer application token (app-only) - doesn't require user consent
    // Only use delegated token if explicitly provided AND app-only token is unavailable
    let token: string | null = null;
    
    // Try app-only token first (preferred for admin operations)
    token = await getAppOnlyAccessToken();
    
    if (!token) {
      // Fallback to delegated token if provided (for testing/development)
      if (accessToken) {
        console.warn('[EntraIdService] Using delegated token (app-only token unavailable)');
        token = accessToken;
      } else {
        throw new Error('No access token available for syncing Entra ID users. Please ensure:\n' +
          '1. Application permissions GroupMember.Read.All, Group.Read.All, and User.Read.All are added to Azure AD app\n' +
          '2. Admin consent is granted for these application permissions\n' +
          '3. Azure app credentials are configured:\n' +
          '   - AZURE_APP_CLIENT_ID (or AUTH_CLIENT_ID)\n' +
          '   - AZURE_APP_CLIENT_SECRET (or AUTH_CLIENT_SECRET)\n' +
          '   - AZURE_TENANT_ID (or AUTH_TENANT_ID)');
      }
    }

    console.log(`[EntraIdService] Starting sync for group: ${groupId}`);
    
    // First verify we can access the group
    try {
      const groupInfo = await getGroupById(groupId, token);
      if (!groupInfo) {
        throw new Error(`Group ${groupId} not found or not accessible`);
      }
    } catch (error: any) {
      if (error.statusCode === 403) {
        throw new Error('Access denied to group. Token may not have Group.Read.All permission. ' +
          'For application tokens, ensure admin consent is granted.');
      }
      throw error;
    }
    
    const members = await getAllStaffMembers(groupId, token);
    console.log(`[EntraIdService] Retrieved ${members.length} members from Entra ID`);

    // Upsert members into cache
    let syncedCount = 0;
    for (const member of members) {
      try {
        await prisma.entraIdUserCache.upsert({
          where: { entraObjectId: member.id },
          update: {
            email: member.email,
            displayName: member.displayName,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
          create: {
            id: randomUUID(),
            entraObjectId: member.id,
            email: member.email,
            displayName: member.displayName,
            lastSyncedAt: new Date(),
          },
        });
        syncedCount++;
      } catch (error: any) {
        console.error(
          `[EntraIdService] Error upserting user ${member.id}:`,
          error.message
        );
        // Continue with other users even if one fails
      }
    }

    // Update lastSyncedAt in config
    await prisma.entraIdConfig.updateMany({
      data: {
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`[EntraIdService] Successfully synced ${syncedCount} users to cache`);

    // Remove users from cache that are no longer in the group
    const cachedUserIds = new Set(members.map((m) => m.id));
    const deletedResult = await prisma.entraIdUserCache.deleteMany({
      where: {
        entraObjectId: {
          notIn: Array.from(cachedUserIds),
        },
      },
    });

    if (deletedResult.count > 0) {
      console.log(
        `[EntraIdService] Removed ${deletedResult.count} stale users from cache`
      );
    }

    return syncedCount;
  } catch (error: any) {
    console.error('[EntraIdService] Error syncing staff members to cache:', error);
    throw error;
  }
}

