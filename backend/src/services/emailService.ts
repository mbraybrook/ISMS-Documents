/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from '@microsoft/microsoft-graph-client';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { getAppOnlyAccessToken } from './sharePointService';

/**
 * Check if email service is configured (Microsoft Graph API)
 */
export function isEmailConfigured(): boolean {
  // Check if Azure app credentials are configured and email from address is set
  return !!(
    config.azure.appClientId &&
    config.azure.appClientSecret &&
    config.azure.tenantId &&
    config.email.from
  );
}

/**
 * Get admin email addresses
 */
export async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
      },
      select: {
        email: true,
      },
    });

    return admins.map((admin) => admin.email).filter((email) => !!email);
  } catch (error: any) {
    log.error('[EMAIL] Failed to get admin emails', { error: error.message || String(error) });
    return [];
  }
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
 * Verify that the mailbox exists and is accessible
 * Exported for testing/debugging purposes
 * 
 * Note: Shared mailboxes may not appear in /users endpoint with application permissions.
 * This function checks both /users and attempts to verify via sendMail endpoint.
 */
export async function verifyMailboxExists(emailAddress: string): Promise<{ exists: boolean; error?: string; isSharedMailbox?: boolean }> {
  try {
    const accessToken = await getAppOnlyAccessToken();
    if (!accessToken) {
      return { exists: false, error: 'Failed to get access token' };
    }

    const client = createGraphClient(accessToken);
    
    // Try to get user information - this will fail if mailbox doesn't exist
    try {
      const _user = await client.api(`/users/${emailAddress}`).get();
      // If we get here, it's a user mailbox
      return { exists: true, isSharedMailbox: false };
    } catch (userError: any) {
      // If /users endpoint fails, it might be a shared mailbox
      // Shared mailboxes don't appear in /users endpoint with application permissions
      // But they might still work with sendMail - we'll let sendMail handle the error
      if (userError.statusCode === 404 || userError.code === 'ErrorInvalidUser') {
        return { 
          exists: false, 
          error: `Mailbox '${emailAddress}' not found in /users endpoint. This may be a shared mailbox - shared mailboxes may not be accessible via /users with application permissions. Try using a regular user mailbox instead, or verify the shared mailbox exists and has Exchange Online enabled.`,
          isSharedMailbox: true
        };
      }
      throw userError;
    }
  } catch (error: any) {
    return { 
      exists: false, 
      error: `Error verifying mailbox: ${error.message || String(error)}` 
    };
  }
}

/**
 * Send email using Microsoft Graph API
 */
async function sendEmail(to: string | string[], subject: string, html: string): Promise<boolean> {
  if (!isEmailConfigured()) {
    log.warn('[EMAIL] Email service not configured. Skipping email send.', {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      reason: 'Missing Azure app credentials or EMAIL_FROM not set',
    });
    return false;
  }

  try {
    // Get app-only access token
    const accessToken = await getAppOnlyAccessToken();
    if (!accessToken) {
      log.error('[EMAIL] Failed to get access token for Microsoft Graph');
      return false;
    }

    // Verify mailbox exists before attempting to send
    // Note: Shared mailboxes may not appear in /users endpoint, but might still work with sendMail
    const mailboxCheck = await verifyMailboxExists(config.email.from);
    if (!mailboxCheck.exists && mailboxCheck.isSharedMailbox) {
      // For shared mailboxes, we'll still try to send - they might work even if /users doesn't find them
      log.warn('[EMAIL] Mailbox not found in /users endpoint (may be shared mailbox)', {
        email: config.email.from,
        error: mailboxCheck.error,
        note: 'Attempting to send anyway - shared mailboxes may work with sendMail even if not found in /users endpoint',
      });
      // Continue to attempt sending - shared mailboxes might still work
    } else if (!mailboxCheck.exists) {
      log.error('[EMAIL] Mailbox verification failed', {
        email: config.email.from,
        error: mailboxCheck.error,
        suggestion: 'The mailbox may not be fully provisioned yet. Wait 15-60 minutes after creating a shared mailbox, or verify it exists in Microsoft 365 Admin Center. Consider using a regular user mailbox instead.',
      });
      return false;
    }

    const client = createGraphClient(accessToken);
    
    // Prepare recipients
    const recipients = Array.isArray(to) ? to : [to];
    const toRecipients = recipients.map(email => ({
      emailAddress: {
        address: email,
      },
    }));

    // Send email using Microsoft Graph API
    // The "from" address must be a mailbox in your tenant (e.g., shared mailbox or user mailbox)
    await client
      .api(`/users/${config.email.from}/sendMail`)
      .post({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: html,
          },
          toRecipients,
        },
        saveToSentItems: true, // Save copy to sent items
      });

    log.info('[EMAIL] Email sent successfully via Microsoft Graph', {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      from: config.email.from,
    });

    return true;
  } catch (error: any) {
    // Provide helpful error messages based on error code
    let errorMessage = error.message || String(error);
    let suggestion = '';

    if (error.statusCode === 404 || error.code === 'ErrorInvalidUser') {
      errorMessage = `Mailbox '${config.email.from}' not found or not accessible`;
      suggestion = 'Verify the mailbox exists in Microsoft 365 Admin Center. Shared mailboxes may take 15-60 minutes to fully provision after creation.';
    } else if (error.statusCode === 403 || error.code === 'ErrorAccessDenied') {
      errorMessage = 'Access denied - Mail.Send permission may not be granted';
      suggestion = 'Ensure Mail.Send application permission is granted with admin consent in Azure AD app registration.';
    } else if (error.statusCode === 400) {
      errorMessage = `Invalid request: ${error.message || String(error)}`;
      suggestion = 'Check that the mailbox address is correct and the message format is valid.';
    }

    log.error('[EMAIL] Failed to send email via Microsoft Graph', {
      error: errorMessage,
      statusCode: error.statusCode,
      code: error.code,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      from: config.email.from,
      suggestion,
    });
    return false;
  }
}

/**
 * HTML email template wrapper
 */
function getEmailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trust Center Notification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #2563eb; margin: 0;">Paythru Trust Center</h1>
  </div>
  <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
    ${content}
  </div>
  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
    <p>This is an automated message from the Paythru Trust Center.</p>
    <p>Please do not reply to this email.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send user approval notification email
 */
export async function sendUserApprovalEmail(userEmail: string, companyName: string): Promise<boolean> {
  const loginUrl = `${config.frontendUrl}/login`;
  
  const content = `
    <h2 style="color: #2563eb; margin-top: 0;">Your Trust Center Access Has Been Approved</h2>
    <p>Dear ${companyName || 'User'},</p>
    <p>We are pleased to inform you that your request for access to the Paythru Trust Center has been approved.</p>
    <p>You can now log in to access the trust center documents using your registered credentials.</p>
    <div style="margin: 30px 0; text-align: center;">
      <a href="${loginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Log In to Trust Center</a>
    </div>
    <p>If you have any questions or need assistance, please contact our support team.</p>
    <p>Best regards,<br>The Paythru Team</p>
  `;

  const html = getEmailTemplate(content);
  return sendEmail(userEmail, 'Your Trust Center Access Has Been Approved', html);
}

/**
 * Send access revocation notification email
 */
export async function sendAccessRevokedEmail(userEmail: string, companyName: string): Promise<boolean> {
  const content = `
    <h2 style="color: #dc2626; margin-top: 0;">Your Trust Center Access Has Been Revoked</h2>
    <p>Dear ${companyName || 'User'},</p>
    <p>We are writing to inform you that your access to the Paythru Trust Center has been revoked.</p>
    <p>If you believe this is an error or have questions about this action, please contact our support team.</p>
    <p style="margin-top: 20px;"><strong>Support Contact:</strong></p>
    <p>Please reach out to us if you need assistance or have any questions regarding this change.</p>
    <p>Best regards,<br>The Paythru Team</p>
  `;

  const html = getEmailTemplate(content);
  return sendEmail(userEmail, 'Your Trust Center Access Has Been Revoked', html);
}

/**
 * Send access restored notification email
 */
export async function sendAccessRestoredEmail(userEmail: string, companyName: string): Promise<boolean> {
  const loginUrl = `${config.frontendUrl}/login`;
  
  const content = `
    <h2 style="color: #2563eb; margin-top: 0;">Your Trust Center Access Has Been Restored</h2>
    <p>Dear ${companyName || 'User'},</p>
    <p>We are pleased to inform you that your access to the Paythru Trust Center has been restored.</p>
    <p>You can now log in to access the trust center documents using your registered credentials.</p>
    <div style="margin: 30px 0; text-align: center;">
      <a href="${loginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Log In to Trust Center</a>
    </div>
    <p>If you have any questions or need assistance, please contact our support team.</p>
    <p>Best regards,<br>The Paythru Team</p>
  `;

  const html = getEmailTemplate(content);
  return sendEmail(userEmail, 'Your Trust Center Access Has Been Restored', html);
}

/**
 * Send new pending request notification to admins
 */
export async function sendNewPendingRequestEmail(
  adminEmails: string[],
  userEmail: string,
  companyName: string
): Promise<boolean> {
  if (adminEmails.length === 0) {
    log.warn('[EMAIL] No admin emails found for pending request notification');
    return false;
  }

  const adminUrl = `${config.frontendUrl}/admin/trust`;

  const content = `
    <h2 style="color: #2563eb; margin-top: 0;">New Trust Center Access Request</h2>
    <p>A new access request has been submitted to the Trust Center.</p>
    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
      <p style="margin: 5px 0;"><strong>Company:</strong> ${companyName}</p>
    </div>
    <p>Please review and approve or deny this request in the admin panel.</p>
    <div style="margin: 30px 0; text-align: center;">
      <a href="${adminUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Review Pending Requests</a>
    </div>
  `;

  const html = getEmailTemplate(content);
  return sendEmail(adminEmails, 'New Trust Center Access Request', html);
}
