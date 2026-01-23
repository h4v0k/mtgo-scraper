# Security Overview - Havok's Spyglass

This document outlines the security measures implemented to protect the application following its transition to a public-facing platform.

## 🛡️ Implemented Protections

### 1. Rate Limiting
- **General API**: Restricted to 100 requests per 15 minutes per IP address to prevent scraping abuse and DDoS.
- **Authentication**: The login endpoint is restricted to **5 attempts per 15 minutes** to mitigate brute-force attacks.

### 2. Authentication & Authorization
- **JWT Protection**: All administrative and state-changing endpoints require a valid JSON Web Token.
- **Admin Lockdown**: Critical functions (User management, Logs, Debugging) require specific `admin` role elevation.
- **Domain Restriction**: The Admin Portal UI is only enabled on authorized domains (Vercel production/Localhost) and filtered by path.

### 3. Database Security
- **Parameterization**: All SQL queries use Turso's parameterized execution to prevent **SQL Injection (SQLi)**.
- **Secrets Management**: Hard-coded credentials have been removed. The system relies entirely on gitignored environment variables and GitHub Secrets for database communication.

### 4. Information Security
- **Header Hardening**: Uses `helmet.js` to set secure HTTP headers (XSS Filter, HSTS, Sniffing protection).
- **Error Masking**: Stack traces and internal paths are hidden in production error responses.
- **Debug Route Lockdown**: The `/api/debug` endpoint is now strictly admin-only.

## ⚠️ Best Practices
- **Token Rotation**: It is recommended to rotate the `TURSO_AUTH_TOKEN` and `JWT_SECRET` periodically via the GitHub Actions Secrets panel.
- **Monitoring**: Visitor and Login logs are available in the Admin Portal for real-time monitoring of potential misuse.
