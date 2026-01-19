# Email Configuration - Microsoft Graph API Setup

## Overview

The Trust Center email notification system uses Microsoft Graph API to send emails via your Azure AD app registration. This eliminates the need for SMTP configuration and integrates seamlessly with your Microsoft 365 tenant.

## Prerequisites

1. Azure AD app registration with client credentials configured
2. Shared mailbox or user mailbox in your Microsoft 365 tenant
3. Admin access to Azure Portal and Microsoft 365 Admin Center

## Setup Steps

### Step 1: Create Shared Mailbox (Recommended)

1. Go to **Microsoft 365 Admin Center** → **Groups** → **Shared mailboxes**
2. Click **Add a shared mailbox**
3. Fill in the details:
   - **Name**: Trust Center Notifications (or similar)
   - **Email**: `trustcenter@paythru.com` (or your preferred address)
4. Click **Add**
5. Optionally add members who need access to this mailbox

**Note**: Shared mailboxes don't require a license and are ideal for automated email sending.

### Step 2: Grant Mail.Send Permission

1. Go to **Azure Portal** → **App Registrations** → Your App
2. Navigate to **API Permissions**
3. Click **Add a permission** → **Microsoft Graph** → **Application permissions**
4. Search for and select `Mail.Send`
5. Click **Add permissions**
6. **CRITICAL**: Click **Grant admin consent for [Your Organization]**

The permission should show as "Granted for [Your Organization]" with a green checkmark.

### Step 3: Update Environment Variables

Add the following to your `backend/.env` file:

```bash
# Email Configuration (Microsoft Graph API)
EMAIL_FROM=trustcenter@paythru.com
```

**Important**: 
- The `EMAIL_FROM` address must match the shared mailbox or user mailbox email address exactly
- Ensure your Azure app credentials are already configured:
  - `AZURE_APP_CLIENT_ID` (or `AUTH_CLIENT_ID`)
  - `AZURE_APP_CLIENT_SECRET` (or `AUTH_CLIENT_SECRET`)
  - `AZURE_TENANT_ID` (or `AUTH_TENANT_ID`)

### Step 4: Remove Old SMTP Configuration (If Present)

If you previously had SMTP configuration, you can remove these variables (they're no longer used):

```bash
# These are no longer needed - remove if present
# EMAIL_SMTP_HOST=
# EMAIL_SMTP_PORT=
# EMAIL_SMTP_USER=
# EMAIL_SMTP_PASS=
```

## Verification

After configuration, test the email functionality:

1. Register a new Trust Center user account
2. Check that admin notification email is sent (if admins exist)
3. Approve the user account
4. Check that approval email is sent to the user

Check backend logs for email sending status:
- Success: `[EMAIL] Email sent successfully via Microsoft Graph`
- Failure: `[EMAIL] Failed to send email via Microsoft Graph` (with error details)

## Troubleshooting

### Email Not Sending

1. **Check Azure App Permissions**:
   - Verify `Mail.Send` application permission is granted
   - Ensure admin consent was granted (not just added)

2. **Verify Mailbox Exists**:
   - Confirm the mailbox exists in Microsoft 365
   - Check the email address matches exactly (case-sensitive)

3. **Check Environment Variables**:
   - Verify `EMAIL_FROM` is set correctly
   - Ensure Azure app credentials are configured

4. **Review Logs**:
   - Check backend logs for specific error messages
   - Common errors:
     - `Failed to get access token`: Azure credentials issue
     - `404 Not Found` or `ErrorInvalidUser`: Mailbox doesn't exist or not fully provisioned
     - `403 Forbidden` or `ErrorAccessDenied`: Permission not granted
     - `Mailbox verification failed`: Mailbox not accessible (see troubleshooting below)

### Permission Issues

If you see `403 Forbidden` errors:

1. Go to Azure Portal → App Registrations → Your App → API Permissions
2. Verify `Mail.Send` shows "Granted for [Your Organization]"
3. If not granted, click **Grant admin consent**
4. Wait a few minutes for permissions to propagate

### Mailbox Not Found (404 / ErrorInvalidUser)

If you see `404 Not Found` or `ErrorInvalidUser` errors:

**IMPORTANT**: Shared mailboxes may not be accessible via the `/users` endpoint with application permissions. This is a known limitation of Microsoft Graph API.

**Possible causes:**
1. **Shared mailbox limitation**: Shared mailboxes don't appear in `/users` endpoint with application permissions - this is expected behavior
2. **Mailbox not fully provisioned**: Shared mailboxes can take 15-60 minutes to fully provision after creation
3. **Mailbox doesn't exist**: Verify the mailbox exists in Microsoft 365 Admin Center
4. **Wrong email address**: Check that `EMAIL_FROM` matches the mailbox address exactly (case-sensitive)

**Solutions:**

1. **Use a regular user mailbox instead** (RECOMMENDED):
   - Shared mailboxes have limitations with application permissions in Graph API
   - Create a dedicated user mailbox for sending emails:
     ```bash
     EMAIL_FROM=noreply@paythru.com  # or trustcenter@paythru.com as a user mailbox
     ```
   - User mailboxes work reliably with application permissions
   - You can still name it `trustcenter@paythru.com` - just create it as a user mailbox, not shared

2. **If you must use a shared mailbox**:
   - Wait 15-60 minutes after creating the shared mailbox
   - The system will attempt to send even if verification fails (shared mailboxes might work with sendMail)
   - Check logs to see if sendMail succeeds despite verification failure

3. **Verify mailbox exists**:
   - Go to **Microsoft 365 Admin Center** → **Groups** → **Shared mailboxes** (for shared)
   - Or **Users** → **Active users** (for user mailbox)
   - Confirm the mailbox is listed and shows as "Active"
   - Check that it's not in a "Pending" or "Deleted" state

4. **Check Exchange Online**:
   - Ensure the mailbox has Exchange Online enabled
   - Shared mailboxes don't need a license, but need Exchange Online
   - User mailboxes need a license

5. **PowerShell verification**:
   ```powershell
   # Check if mailbox exists
   Get-Mailbox -Identity "trustcenter@paythru.com"
   
   # Check mailbox type
   Get-Mailbox -Identity "trustcenter@paythru.com" | Select-Object RecipientTypeDetails
   ```
   - `RecipientTypeDetails` should show `SharedMailbox` or `UserMailbox`

## Benefits of Microsoft Graph API

- ✅ No SMTP credentials needed
- ✅ Uses existing Azure app authentication
- ✅ More secure (OAuth2 app-only auth)
- ✅ Integrated with Microsoft 365
- ✅ Better deliverability
- ✅ Sent items automatically saved
- ✅ No additional infrastructure required

## Email Notifications Sent

The system sends emails for:

1. **New User Registration**: Notifies admins when a new Trust Center access request is created
2. **User Approval**: Notifies users when their account is approved
3. **Access Revocation**: Optionally notifies users when their access is revoked (admin choice)

All emails are sent from the mailbox specified in `EMAIL_FROM`.
