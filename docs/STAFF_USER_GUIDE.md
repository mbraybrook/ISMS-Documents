# Staff User Guide

## Overview

This guide describes the staff user experience for the ISMS Document Management and Compliance application. Staff users have read-only access to approved documents and can acknowledge updated document versions.

## Staff User Journey

### 1. Login

When a staff user logs in with their Microsoft account:
- They are automatically redirected to the **My ISMS** dashboard (`/staff`)
- Admin and Editor users are redirected to the main admin dashboard (`/`)

### 2. My ISMS Dashboard (`/staff`)

The staff dashboard provides an overview of:
- **Your Required Actions**: Shows the count of documents requiring acknowledgment with a link to the acknowledgment page
- **Recently Updated Documents**: Lists the 10 most recently updated approved documents with acknowledgment status
- **ISMS Review Status**: Read-only information about documents overdue for review or with upcoming reviews

### 3. Acknowledgment Page (`/staff/acknowledgments`)

Staff users can:
- View all documents requiring their acknowledgment
- See document details: title, type, version, owner, storage location, and when it was changed
- Open documents in SharePoint or Confluence
- Use "Acknowledge All" to acknowledge all pending documents at once

**Badges:**
- **Requires acknowledgment** (blue): Document requires acknowledgment
- **Overdue acknowledgment** (red): Document has been pending for more than 30 days

### 4. Documents Page (`/staff/documents`)

Staff users can:
- View all approved documents in a read-only table
- Filter by:
  - Document type
  - Owner
  - Review status (Overdue review / Upcoming review)
  - Acknowledgment requirement
- Search documents by title, type, or owner
- Open documents in SharePoint or Confluence

**Badges:**
- **Requires acknowledgment** (blue): Document requires acknowledgment
- **Overdue for review** (red): Next review date has passed
- **Review upcoming** (yellow): Review is due within the next 30 days

## Staff User Permissions

### What Staff Users CAN Do:
- ✅ Read approved documents list
- ✅ View pending acknowledgments
- ✅ Create acknowledgments for themselves (bulk "Acknowledge All" or per-document)
- ✅ Open linked documents (SharePoint/Confluence)
- ✅ View ISMS review status (read-only)

### What Staff Users CANNOT Do:
- ❌ Create, update, or delete documents
- ❌ Create, update, or delete review tasks
- ❌ Access risks, controls, users, or configuration
- ❌ View draft or in-review documents
- ❌ Access admin/editor features

## Configuration

### Overdue Acknowledgment Threshold

The threshold for marking an acknowledgment as "overdue" is configurable. Currently set to **30 days** from the document's `lastChangedDate`.

This can be adjusted by modifying the `OVERDUE_ACKNOWLEDGMENT_DAYS` constant in:
- `frontend/src/pages/StaffAcknowledgmentPage.tsx`

### Environment Variables

No new environment variables are required for the staff user experience. The application uses existing configuration for:
- Authentication (Entra ID)
- SharePoint integration
- Confluence integration
- Database connection

## Navigation

Staff users see a simplified navigation menu with:
- **My ISMS**: Link to staff dashboard
- **Acknowledgment**: Link to acknowledgment page
- **Documents**: Link to documents page
- **Profile**: User profile page

Admin/Editor features (Risk Management, Asset Management, SoA Export) are hidden from staff users.

## Troubleshooting

### Cannot see documents
- Ensure you are logged in with a STAFF role account
- Only APPROVED documents are visible to staff users
- Check that documents have `status = 'APPROVED'`

### Cannot acknowledge documents
- Ensure the document has `requiresAcknowledgement = true`
- Verify the document version has changed since your last acknowledgment
- Check that you are logged in and authenticated

### Cannot open SharePoint/Confluence links
- Ensure you have appropriate permissions in SharePoint/Confluence
- Check that the document has valid storage location identifiers
- Verify your Microsoft Graph token is valid (for SharePoint)

## Support

For issues or questions, contact your ISMS administrator.


