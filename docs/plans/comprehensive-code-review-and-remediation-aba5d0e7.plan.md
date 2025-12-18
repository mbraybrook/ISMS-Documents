<!-- aba5d0e7-b7b4-4dc0-b589-2e5e8638f735 823a78f0-9687-4118-8fe6-6ca3d3d99028 -->
# Comprehensive Code Review and Remediation Plan

## Executive Summary

This plan addresses security vulnerabilities, dependency management, code quality, duplication, maintainability, and test coverage across the ISMS Documentation application. Findings are prioritized by impact on security, stability, and maintainability.

## 1. Security Vulnerabilities and Remediation

### Critical Priority

#### 1.1 Missing Security Headers (HIGH)

- **Issue**: No Helmet.js middleware for security headers (XSS protection, content-type sniffing, frame options, etc.)
- **Location**: `backend/src/index.ts`
- **Action**: Install and configure `helmet` package to set security headers
- **Impact**: Prevents XSS, clickjacking, MIME-type sniffing attacks

#### 1.2 JWT Secret Validation (HIGH)

- **Issue**: JWT secret checked for existence but not validated as non-empty string
- **Location**: `backend/src/middleware/trustAuth.ts:29`, `backend/src/routes/trust/auth.ts:149`
- **Action**: Add validation to ensure JWT secret is non-empty and meets minimum length requirements
- **Impact**: Prevents authentication bypass if secret is misconfigured

#### 1.3 Error Handler Stack Trace Exposure (MEDIUM)

- **Issue**: Error handler conditionally exposes stack traces but should ensure production never exposes them
- **Location**: `backend/src/middleware/errorHandler.ts:21`
- **Action**: Add explicit check to ensure `NODE_ENV === 'production'` never exposes stack traces
- **Impact**: Prevents information disclosure in production

#### 1.4 Console Logging of Sensitive Data (MEDIUM)

- **Issue**: 284 console.log statements, some may log sensitive information (tokens, user data)
- **Location**: Multiple files, especially `backend/src/middleware/auth.ts:162,175`
- **Action**: 
- Replace console.log with proper logging library (winston/pino)
- Remove or sanitize sensitive data from logs
- Implement log levels and structured logging
- **Impact**: Prevents sensitive data leakage in logs

#### 1.5 Missing Global Rate Limiting (MEDIUM)

- **Issue**: Rate limiting only on specific routes (login, register, download), not globally
- **Location**: `backend/src/index.ts`
- **Action**: Add global rate limiter for all API routes, with stricter limits for auth endpoints
- **Impact**: Prevents brute force and DoS attacks

#### 1.6 File Upload Validation Enhancement (MEDIUM)

- **Issue**: File upload validation relies on mimetype and extension, which can be spoofed
- **Location**: `backend/src/routes/risks.ts:1398`, `backend/src/routes/assets.ts:384`, `backend/src/routes/legislation.ts:234`, `backend/src/routes/interestedParties.ts:245`
- **Action**: 
- Add magic number/file signature validation
- Implement virus scanning for uploaded files
- Add file content validation beyond extension check
- **Impact**: Prevents malicious file uploads

#### 1.7 CORS Configuration Hardening (LOW)

- **Issue**: Development mode allows any localhost origin, could be more restrictive
- **Location**: `backend/src/index.ts:43`
- **Action**: Use specific localhost ports or environment-based allowlist
- **Impact**: Reduces attack surface in development

#### 1.8 Missing CSRF Protection (LOW)

- **Issue**: No CSRF token validation for state-changing operations
- **Action**: Implement CSRF protection for POST/PUT/DELETE requests (consider using `csurf` or similar)
- **Impact**: Prevents cross-site request forgery attacks

### Incomplete Features (Security Impact)

#### 1.9 Password Reset Not Implemented (MEDIUM)

- **Issue**: Password reset endpoint has TODO comment, not implemented
- **Location**: `backend/src/routes/trust/auth.ts:233`
- **Action**: Implement secure password reset flow with time-limited tokens
- **Impact**: Security feature gap

#### 1.10 Email Notifications Not Implemented (LOW)

- **Issue**: Email sending TODOs in approval/denial flows
- **Location**: `backend/src/routes/trust/index.ts:675,731`
- **Action**: Implement email notifications for user approval/denial
- **Impact**: User experience and audit trail

## 2. Dependency Audit

### 2.1 Outdated Dependencies

- **Action**: Run `npm audit` and `npm outdated` to identify:
- Packages with known vulnerabilities
- Packages with major version updates available
- Packages that are no longer maintained

### 2.2 Unused Dependencies

- **Potential candidates for removal**:
- `better-sqlite3` (devDependency) - verify if still needed after PostgreSQL migration
- `libreoffice-convert` - verify usage
- `pdfkit` - verify if used alongside `pdf-lib`
- **Action**: Use `depcheck` or similar tool to identify unused dependencies

### 2.3 Dependency Security

- **Action**: 
- Set up Dependabot or Renovate for automated security updates
- Review and update packages with known CVEs
- Pin dependency versions in package-lock.json (already done)

## 3. Code Quality Issues

### 3.1 Inconsistent Error Handling

- **Issue**: Some routes use try-catch, others rely on error handler middleware inconsistently
- **Action**: Standardize error handling pattern across all routes
- **Files**: All route files in `backend/src/routes/`

### 3.2 Validation Pattern Duplication

- **Issue**: Similar validation logic repeated across routes
- **Location**: Multiple route files use `express-validator` with similar patterns
- **Action**: Create shared validation middleware/utilities
- **Files**: `backend/src/routes/*.ts`

### 3.3 Type Safety Improvements

- **Issue**: Use of `any` types in several places reduces type safety
- **Action**: Replace `any` with proper types or `unknown` with type guards
- **Files**: Check `backend/src/middleware/auth.ts`, route handlers

### 3.4 Missing Input Sanitization

- **Issue**: Input validation exists but HTML/script sanitization may be missing for user-generated content
- **Action**: Add input sanitization library (e.g., `dompurify` for frontend, `sanitize-html` for backend)
- **Impact**: Prevents XSS from stored user input

## 4. Code Duplication

### 4.1 Multer Configuration Duplication (HIGH)

- **Issue**: Identical multer configuration repeated in 4 route files
- **Location**: 
- `backend/src/routes/risks.ts:1393`
- `backend/src/routes/assets.ts:379`
- `backend/src/routes/legislation.ts:229`
- `backend/src/routes/interestedParties.ts:240`
- **Action**: Extract to shared utility: `backend/src/lib/multerConfig.ts`
- **Impact**: Reduces maintenance burden, ensures consistent file upload security

### 4.2 Validation Middleware Duplication

- **Issue**: Similar validation error handling pattern repeated
- **Location**: Multiple route files have `validate` function
- **Action**: Create shared validation middleware in `backend/src/middleware/validation.ts`

### 4.3 Route Handler Patterns

- **Issue**: Similar patterns for error handling, user lookup, role checking
- **Action**: Create shared route handler utilities or middleware

## 5. Maintainability Improvements

### 5.1 Logging Infrastructure

- **Issue**: 284 console.log statements scattered throughout codebase
- **Action**: 
- Implement structured logging (winston/pino)
- Create logging utility module
- Replace all console.log/error/warn with logger
- Configure log levels and output formats
- **Files**: All backend source files

### 5.2 Configuration Management

- **Issue**: Configuration loading logic is complex with multiple dotenv calls
- **Location**: `backend/src/config.ts:6-45`
- **Action**: Simplify configuration loading, add validation schema
- **Impact**: Easier to understand and maintain

### 5.3 Documentation

- **Issue**: Some complex functions lack JSDoc comments
- **Action**: Add JSDoc comments to:
- Service functions
- Complex middleware
- Utility functions
- **Files**: `backend/src/services/`, `backend/src/middleware/`

### 5.4 Naming Conventions

- **Issue**: Some inconsistencies in naming (e.g., `TrustAuthRequest` vs `AuthRequest`)
- **Action**: Review and standardize naming conventions across codebase

## 6. 6: Test Coverage

### Current state

Backend tests:

- Authentication middleware: covered (token validation, email domain, issuer validation)

- Authorization middleware: covered (role-based access, department filtering)

- Route tests: Risks, Documents, Acknowledgments are covered

- Service tests: Risk, SoA, SharePoint, Confluence services are covered

Frontend tests:

- Auth service: covered (MSAL, login/logout, token retrieval)

- API service: basic coverage

E2E tests:

- Authentication flows: covered

- Document management: covered

- Acknowledgments: covered

- SoA export: basic coverage

Infrastructure:

- CI/CD pipeline configured

- Coverage reporting to Codecov

- 70% thresholds set

### Remaining gaps

Backend:

- Rate limiting middleware tests

- File upload security tests

- Error handler tests

- Trust Centre authentication tests

- Missing route tests: Controls, Reviews, Users, Dashboard, Trust Centre

- Missing service tests: Similarity, Watermark, Document Conversion, PDF Cache, Trust Audit

Frontend:

- Auth Context tests

- Trust Auth Context tests

- Component tests (modals, forms)

- Page tests (Documents, Risks, Controls, etc.)

- Form validation tests

E2E:

- Risk management workflows

- Control management

- File upload security

- Rate limiting behavior

- Trust Centre workflows

Security testing:

- XSS payload testing

- File upload security

- Authentication bypass attempts

- Rate limiting enforcement

- Authorization escalation tests

## 7. Additional Recommendations

### 7.1 Environment Variable Validation

- **Issue**: Config validates some env vars but not all required ones
- **Action**: Add comprehensive validation for all required environment variables at startup
- **Location**: `backend/src/config.ts`

### 7.2 Database Connection Security

- **Action**: Ensure database connections use SSL in production
- **Location**: `backend/src/lib/prisma.ts`, `backend/src/config.ts`

### 7.3 API Documentation

- **Action**: Consider adding OpenAPI/Swagger documentation for API endpoints
- **Impact**: Improves developer experience and API discoverability

### 7.4 Monitoring and Observability

- **Action**: Add application monitoring (e.g., Sentry for error tracking, Prometheus for metrics)
- **Impact**: Better production visibility and debugging

## Implementation Priority

### Phase 1 (Critical - Immediate)

1. Add Helmet.js security headers
2. Fix JWT secret validation
3. Remove sensitive data from console logs
4. Extract multer configuration duplication

### Phase 2 (High - This Sprint)

5. Implement structured logging
6. Add global rate limiting
7. Enhance file upload validation
8. Complete password reset implementation

### Phase 3 (Medium - Next Sprint)

9. Dependency audit and updates
10. Standardize error handling
11. Improve test coverage
12. Add input sanitization

### Phase 4 (Low - Backlog)

13. CSRF protection
14. API documentation
15. Monitoring setup
16. Code documentation improvements

### To-dos

- [ ] Install and configure Helmet.js for security headers in backend/src/index.ts
- [ ] Add non-empty string validation for JWT secrets in trustAuth.ts and trust/auth.ts
- [ ] Ensure error handler never exposes stack traces in production
- [ ] Replace console.log with structured logging library (winston/pino) and sanitize sensitive data
- [ ] Add global rate limiter for all API routes in backend/src/index.ts
- [ ] Enhance file upload validation with magic number checking and content validation
- [ ] Extract duplicate multer configuration to shared utility backend/src/lib/multerConfig.ts
- [ ] Run npm audit and npm outdated, identify and remove unused dependencies
- [ ] Run coverage report and add tests for authentication, authorization, file uploads, and rate limiting
- [ ] Run coverage report and add tests for auth context, API services, and form validation
- [ ] Implement secure password reset flow with time-limited tokens
- [ ] Add input sanitization library to prevent XSS from stored user input