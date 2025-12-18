<!-- 8c23a9f4-29bd-4c55-8703-234f731382b7 bcf77d19-49c3-4824-b994-ebdf03b73060 -->
# Restrict Admin Console to @paythru.com Email Domain

## Current State

- Admin console uses Azure AD authentication with tenant-specific authority
- Accounts are automatically created when users authenticate via `/auth/sync`
- Currently only validates tenant ID, not email domain
- Trust center uses separate email/password authentication (unaffected)

## Implementation Plan

### 1. Add Configuration for Allowed Email Domain

- Add `AUTH_ALLOWED_EMAIL_DOMAIN` environment variable to `backend/src/config.ts`
- Default to `paythru.com` if not specified
- Add to `config.auth` object

### 2. Add Domain Validation in Authentication Middleware

- Update `backend/src/middleware/auth.ts` to validate email domain after extracting user email
- Reject tokens with unauthorized email domains before proceeding
- Return 403 error with clear message: "Access restricted to @paythru.com email addresses"
- Apply validation in both legacy token path (sts.windows.net) and modern token path

### 3. Add Domain Validation in Auth Sync Route

- Update `backend/src/routes/auth.ts` `/sync` endpoint to validate email domain
- Prevent account creation for unauthorized domains
- Return 403 error if email domain doesn't match
- This provides defense-in-depth even if middleware check is bypassed

### 4. Handle Edge Cases

- Handle cases where email might be missing (should already be rejected)
- Ensure validation works with various email field formats (email, preferred_username, upn, etc.)
- Log domain validation failures for security monitoring

## Files to Modify

- `backend/src/config.ts` - Add allowed email domain configuration
- `backend/src/middleware/auth.ts` - Add domain validation after email extraction
- `backend/src/routes/auth.ts` - Add domain validation in sync endpoint

## Testing Considerations

- Verify @paythru.com emails can authenticate successfully
- Verify non-@paythru.com emails are rejected
- Verify trust center authentication remains unaffected
- Test with various email formats in token payload