# Security & Compliance

## 🔒 Security Overview

The Church SACCO Platform implements multiple layers of security to protect sensitive financial and personal data, ensure compliance with regulations, and maintain trust with members.

## 🛡️ Data Security

### 1. PII Encryption

**Implementation:** Database-level encryption using PostgreSQL pgcrypto extension

**Encrypted Fields:**

- ID/Passport numbers
- Phone numbers (all types)
- Next of kin phone numbers

**Encryption Method:**

- **Algorithm:** AES-256 (Advanced Encryption Standard)
- **Mode:** Symmetric encryption with pgp_sym_encrypt
- **Key Management:** Environment-based encryption keys
- **Storage:** Encrypted data stored as BYTEA (binary)

**Code Example:**

```sql
-- Encryption function
CREATE FUNCTION enc(data TEXT, key TEXT)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(data, key, 'cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage in trigger
NEW.idNumberEncrypted := enc(NEW.idPassportNumber, current_setting('pii.encryption_key'));
```

**Search Capability:**

- Last 4 digits stored unencrypted for search/display
- Full decryption requires encryption key
- Balance between security and usability

### 2. Data in Transit

**HTTPS/TLS:**

- All API communications encrypted with TLS 1.3
- SSL certificates managed by hosting provider
- Automatic HTTPS redirection
- HSTS (HTTP Strict Transport Security) enabled

**Supabase Security:**

- PostgreSQL connections over SSL
- Connection pooling with SSL
- Encrypted backups

### 3. Data at Rest

**Database Encryption:**

- Supabase provides encryption at rest
- Encrypted storage volumes
- Encrypted backups
- Point-in-time recovery

**File Storage:**

- Supabase Storage with encryption
- Signed URLs for secure access
- Access control policies

## 🔐 Authentication & Authorization

### Authentication

**Supabase Auth:**

- JWT (JSON Web Token) based authentication
- Secure password hashing (bcrypt)
- Password complexity requirements
- Account lockout after failed attempts

**Token Management:**

```typescript
// Access token - short-lived (1 hour)
// Refresh token - long-lived (30 days)
{
  "access_token": "eyJhbGci...",
  "refresh_token": "v1.refresh...",
  "expires_in": 3600
}
```

**Session Security:**

- Secure cookie storage
- HTTP-only cookies
- SameSite=Strict
- CSRF protection

### Authorization

**Role-Based Access Control (RBAC):**

| Role      | Permissions                                         |
| --------- | --------------------------------------------------- |
| ADMIN     | Full system access, user management, all operations |
| TREASURER | Financial operations, reports, transactions         |
| SECRETARY | Member management, document handling                |
| CHAIRMAN  | Oversight, approvals, reports (read-only)           |
| MEMBER    | Self-service, view own data only                    |

**Implementation:**

```typescript
// NestJS Guard
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get('roles', context.getHandler());
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.some(role => user.role === role);
  }
}

// Usage
@Roles('ADMIN', 'TREASURER')
@Get('transactions')
async getTransactions() { ... }
```

**Row-Level Security (RLS):**

Database-level access control enforced automatically:

```sql
-- Members can only view their own data
CREATE POLICY member_view_own ON "Member"
  FOR SELECT
  USING (userId = auth.uid()::TEXT);

-- Admins can view all data
CREATE POLICY admin_view_all ON "Member"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.uid()::TEXT
      AND u.role = 'ADMIN'
    )
  );

-- Treasurers can view financial data
CREATE POLICY treasurer_view_financial ON "Repayment"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.uid()::TEXT
      AND u.role IN ('ADMIN', 'TREASURER')
    )
  );
```

## 📝 Audit & Compliance

### Comprehensive Audit Trail

**What is Tracked:**

- Every INSERT, UPDATE, DELETE operation
- User who made the change (actor)
- Branch context (branch_id)
- Before state (before_json)
- After state (after_json)
- Changed fields (changed_fields array)
- Timestamp (at)

**Implementation:**

```sql
-- Audit log structure
CREATE TABLE "audit_log" (
  id             UUID PRIMARY KEY,
  table_name     TEXT NOT NULL,
  row_id         TEXT NOT NULL,
  actor          TEXT,              -- From JWT
  branch_id      TEXT,              -- From JWT
  action         TEXT NOT NULL,     -- INSERT/UPDATE/DELETE
  before_json    JSONB,
  after_json     JSONB,
  changed_fields TEXT[],
  at             TIMESTAMPTZ
);

-- Automatic trigger on all key tables
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Member"
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();
```

**Audit Trail Features:**

- ✅ **Immutable records** - Cannot be modified or deleted
- ✅ **Point-in-time reconstruction** - Rebuild any record at any past time
- ✅ **Change tracking** - See exactly what changed
- ✅ **User attribution** - Know who made every change
- ✅ **Complete history** - Full lifecycle of every record

**Query Examples:**

```sql
-- Get full history of a member
SELECT * FROM get_audit_trail('Member', 'member-id', 100);

-- Reconstruct member record as of Jan 1, 2025
SELECT get_record_at_time('Member', 'member-id', '2025-01-01 00:00:00+00');

-- Get all changes by a user
SELECT * FROM get_audit_by_actor('user-id', NOW() - INTERVAL '30 days', NOW());
```

### Immutable Receipts

**Receipt System:**

- Auto-generated unique numbers
- Format: `BR{branch}-YYYYMM-{NNNNN}`
- Cannot be changed once created
- Concurrency-safe generation

**Implementation:**

```sql
-- Trigger prevents updates
CREATE TRIGGER repayment_receipt_immutable
  BEFORE UPDATE ON "Repayment"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_receipt_update_trigger();

-- Attempting to update throws error
UPDATE "Repayment" SET "receiptNumber" = 'NEW-001' WHERE id = 'test-id';
-- ERROR: Receipt numbers are immutable and cannot be updated
```

## 📋 Compliance Standards

### GDPR Compliance

**Right to Access:**

```typescript
// Export all data for a member
async exportMemberData(memberId: string) {
  const member = await getMemberProfile(memberId);
  const transactions = await getTransactions(memberId);
  const loans = await getLoans(memberId);
  const auditTrail = await getAuditTrail('Member', memberId);

  return {
    profile: member,
    transactions,
    loans,
    auditTrail,
    exportDate: new Date()
  };
}
```

**Right to Erasure:**

```sql
-- Delete member data (with audit trail)
DELETE FROM "Member" WHERE id = 'member-id';

-- Audit log captures deletion
SELECT * FROM "audit_log"
WHERE table_name = 'Member'
  AND row_id = 'member-id'
  AND action = 'DELETE';
-- before_json contains all deleted data for compliance
```

**Right to Rectification:**

- All updates tracked in audit log
- Before/after states captured
- Member can request corrections
- Changes attributed to specific users

**Data Minimization:**

- Only collect necessary data
- PII encrypted and access-controlled
- Regular data retention reviews
- Automated data cleanup processes

### Financial Regulations

**Record Keeping:**

- ✅ 7-year retention of financial records
- ✅ Complete transaction history
- ✅ Immutable receipts
- ✅ Audit trail for all changes

**Fraud Prevention:**

- ✅ User attribution for all transactions
- ✅ Approval workflows (planned)
- ✅ Duplicate detection
- ✅ Anomaly monitoring (planned)

**Anti-Money Laundering (AML):**

- ⏳ Transaction monitoring (planned)
- ⏳ Suspicious activity reporting (planned)
- ⏳ Member verification (KYC) (planned)
- ⏳ Large transaction alerts (planned)

## 🔍 Security Monitoring

### Logging

**Application Logs:**

- Request/response logging
- Error tracking
- Performance monitoring
- Security events

**Database Logs:**

- Query performance
- Connection monitoring
- Failed login attempts
- RLS policy violations

**Audit Logs:**

- User actions
- Data changes
- Access patterns
- System events

### Alerts (Planned)

**Security Alerts:**

- Failed login attempts
- Unauthorized access attempts
- Unusual activity patterns
- Data export requests
- Large transactions

**System Alerts:**

- Database performance issues
- API errors
- Storage quota warnings
- Backup failures

## 🛡️ Vulnerability Management

### Security Practices

**Code Security:**

- ✅ Input validation (class-validator, Zod)
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS prevention (React escaping)
- ✅ CSRF protection (SameSite cookies)
- ✅ Secure dependencies (regular audits)

**Dependency Management:**

```bash
# Regular security audits
pnpm audit

# Automated dependency updates
# GitHub Dependabot configured

# Known vulnerabilities check
pnpm audit --audit-level=high
```

**Code Quality:**

- ESLint for code quality
- TypeScript for type safety
- Prettier for consistency
- Pre-commit hooks (Husky)

### Security Testing

**Planned Security Tests:**

- ⏳ Penetration testing (annual)
- ⏳ Vulnerability scanning (quarterly)
- ⏳ Code security review (per release)
- ⏳ Third-party security audit (annual)

## 🔐 Key Management

### Encryption Keys

**Storage:**

- Environment variables (not in code)
- Encrypted in CI/CD pipelines
- Rotated regularly
- Access-controlled

**Key Hierarchy:**

```
Master Key (Infrastructure)
    ├── Database Encryption Key
    ├── PII Encryption Key
    ├── JWT Signing Key
    └── API Keys
```

**Best Practices:**

- Different keys per environment
- Regular key rotation (quarterly)
- Secure key storage (Secrets Manager)
- Limited key access
- Audit key usage

## 🚨 Incident Response

### Security Incident Plan

**Detection:**

- Automated monitoring
- Alert systems
- User reports
- Audit log analysis

**Response:**

1. **Immediate** - Contain the incident
2. **Investigation** - Analyze the cause
3. **Remediation** - Fix the vulnerability
4. **Communication** - Notify affected parties
5. **Documentation** - Record lessons learned

**Post-Incident:**

- Root cause analysis
- Security improvements
- Policy updates
- Team training

## 📊 Security Metrics

### Key Performance Indicators

**Access Control:**

- Failed login attempts
- Unauthorized access attempts
- RLS policy violations
- Role assignment changes

**Data Protection:**

- Encryption coverage (%)
- PII access logs
- Data export requests
- Backup success rate

**Audit & Compliance:**

- Audit log completeness
- Compliance checklist status
- Policy violations
- Security training completion

## 🔒 Best Practices for Developers

### Secure Coding Guidelines

**1. Never Store Sensitive Data in Plain Text**

```typescript
// ❌ Bad
const user = { password: "password123" };

// ✅ Good
const user = { passwordHash: await bcrypt.hash("password123", 10) };
```

**2. Always Validate Input**

```typescript
// ❌ Bad
const age = parseInt(req.body.age);

// ✅ Good
import { z } from "zod";
const schema = z.object({ age: z.number().min(0).max(150) });
const { age } = schema.parse(req.body);
```

**3. Use Parameterized Queries**

```typescript
// ❌ Bad (SQL Injection risk)
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Good (Prisma handles this)
const user = await prisma.user.findUnique({ where: { id: userId } });
```

**4. Check Permissions**

```typescript
// ❌ Bad
@Get('members/:id')
async getMember(@Param('id') id: string) {
  return this.membersService.findOne(id);
}

// ✅ Good
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MEMBER')
@Get('members/:id')
async getMember(@Param('id') id: string, @Request() req) {
  if (req.user.role !== 'ADMIN' && req.user.id !== id) {
    throw new ForbiddenException();
  }
  return this.membersService.findOne(id);
}
```

**5. Never Log Sensitive Data**

```typescript
// ❌ Bad
console.log("User data:", { id, password, idNumber });

// ✅ Good
console.log("User authenticated:", { id, email });
```

## 📚 Security Resources

### Documentation

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [GDPR Guidelines](https://gdpr.eu/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

### Tools

- [Snyk](https://snyk.io/) - Dependency scanning
- [SonarQube](https://www.sonarqube.org/) - Code quality
- [OWASP ZAP](https://www.zaproxy.org/) - Penetration testing

---

_Document Version: 1.0_  
_Last Updated: January 12, 2025_  
_Status: ✅ Active_
