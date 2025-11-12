# PII Encryption Configuration Guide

## Overview

This guide explains how to configure and use PGCrypto-based encryption for Personally Identifiable Information (PII) in the ACK Thiboro SACCO platform.

## 🔐 What Gets Encrypted

The following sensitive fields are encrypted at rest using PGP symmetric encryption:

### Member Table
- **ID/Passport Number** (`idPassportNumber`)
  - Encrypted: `idNumberEncrypted` (BYTEA)
  - Display: `idLast4` (VARCHAR(4))
  
- **Primary Phone** (`telephone`)
  - Encrypted: `phoneEncrypted` (BYTEA)
  - Display: `phoneLast4` (VARCHAR(4))
  
- **Alternative Phone** (`telephoneAlt`)
  - Encrypted: `phoneAltEncrypted` (BYTEA)
  - Display: `phoneAltLast4` (VARCHAR(4))
  
- **Next of Kin Phone** (`nextOfKinPhone`)
  - Encrypted: `nextOfKinPhoneEncrypted` (BYTEA)
  - Display: `nextOfKinPhoneLast4` (VARCHAR(4))

## 🔑 Encryption Key Management

### 1. Generate Encryption Key

```bash
# Generate a strong random key (32 bytes = 256 bits)
openssl rand -base64 32

# Example output:
# aB3xY9kL2mN5pQ8rS6tV4wZ1cD7eF0gH9iJ2kL5mN8pQ=
```

### 2. Set Environment Variables

#### Development (.env)
```env
# PII Encryption Key (NEVER commit this to source control!)
PII_ENCRYPTION_KEY=your-generated-key-here-change-in-production

# Supabase Connection
DATABASE_URL=postgresql://postgres:password@localhost:54322/postgres
```

#### Production
```bash
# Set via your hosting platform's environment variables
# Examples:

# Vercel
vercel env add PII_ENCRYPTION_KEY production

# Heroku
heroku config:set PII_ENCRYPTION_KEY=your-key-here

# AWS Lambda
aws lambda update-function-configuration \
  --function-name your-function \
  --environment Variables={PII_ENCRYPTION_KEY=your-key-here}

# Docker
docker run -e PII_ENCRYPTION_KEY=your-key-here your-image
```

### 3. Key Rotation Strategy

```bash
# Generate new key
NEW_KEY=$(openssl rand -base64 32)

# Steps for key rotation:
# 1. Deploy code that can decrypt with both old and new keys
# 2. Re-encrypt all data with new key
# 3. Update environment variable to new key only
# 4. Remove old key from code
```

## 🛠️ Backend Implementation

### Option 1: NestJS with Supabase

Update your Supabase service to set the encryption key for each session:

```typescript
// apps/api/src/supabase/supabase.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;
  private piiEncryptionKey: string;

  constructor(private configService: ConfigService) {
    this.piiEncryptionKey = this.configService.get<string>('PII_ENCRYPTION_KEY');
    
    if (!this.piiEncryptionKey) {
      console.warn('⚠️  PII_ENCRYPTION_KEY not set - encrypted fields will not work');
    }
  }

  onModuleInit() {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    );
  }

  /**
   * Get Supabase client with PII encryption key set in session
   */
  async getClientWithPIIKey(): Promise<SupabaseClient> {
    if (this.piiEncryptionKey) {
      // Set encryption key for this session
      await this.supabase.rpc('exec_sql', {
        sql: `SET app.pii_key = '${this.piiEncryptionKey}'`
      });
    }
    
    return this.supabase;
  }

  /**
   * Execute query with PII encryption key
   */
  async withPIIKey<T>(callback: (client: SupabaseClient) => Promise<T>): Promise<T> {
    const client = await this.getClientWithPIIKey();
    try {
      return await callback(client);
    } finally {
      // Clear key after use
      await client.rpc('exec_sql', { sql: 'RESET app.pii_key' });
    }
  }

  getAdminClient(): SupabaseClient {
    return this.supabase;
  }
}
```

### Using the Service

```typescript
// apps/api/src/members/members.service.ts

@Injectable()
export class MembersService {
  constructor(private supabaseService: SupabaseService) {}

  async findOne(id: string) {
    return this.supabaseService.withPIIKey(async (client) => {
      // Query with decrypted PII
      const { data, error } = await client
        .from('MemberWithDecryptedPII')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    });
  }

  async create(createMemberDto: CreateMemberDto) {
    return this.supabaseService.withPIIKey(async (client) => {
      // Insert - encryption happens automatically via trigger
      const { data, error } = await client
        .from('Member')
        .insert(createMemberDto)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  }

  async search(phoneLastDigits: string) {
    // Search by last 4 digits (no encryption key needed)
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('Member')
      .select('id, memberNumber, firstName, lastName, phoneLast4')
      .eq('phoneLast4', phoneLastDigits);

    if (error) throw error;
    return data;
  }
}
```

### Option 2: Direct PostgreSQL with node-postgres

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function queryWithEncryption<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // Set encryption key for this session
    await client.query(`SET app.pii_key = $1`, [process.env.PII_ENCRYPTION_KEY]);
    
    // Execute callback
    return await callback(client);
  } finally {
    // Clear key and release client
    await client.query('RESET app.pii_key');
    client.release();
  }
}

// Usage
async function getMemberWithPII(memberId: string) {
  return queryWithEncryption(async (client) => {
    const result = await client.query(
      `SELECT 
        "memberNumber",
        "firstName",
        "lastName",
        "idLast4",
        dec("idNumberEncrypted") as "idNumber",
        "phoneLast4",
        dec("phoneEncrypted") as "phone"
       FROM "Member"
       WHERE id = $1`,
      [memberId]
    );
    return result.rows[0];
  });
}
```

## 📝 Prisma Schema Updates

Update your Prisma schema to include encrypted fields:

```prisma
// db/prisma/schema.prisma

model Member {
  id                    String   @id
  userId                String   @unique
  memberNumber          String   @unique
  firstName             String
  lastName              String
  email                 String   @unique
  
  // Original fields (kept for backward compatibility, will be deprecated)
  idPassportNumber      String   @unique
  telephone             String
  telephoneAlt          String?
  nextOfKinPhone        String
  
  // Encrypted fields (BYTEA columns)
  idNumberEncrypted     Bytes?   @db.Bytea
  phoneEncrypted        Bytes?   @db.Bytea
  phoneAltEncrypted     Bytes?   @db.Bytea
  nextOfKinPhoneEncrypted Bytes? @db.Bytea
  
  // Display fields (last 4 digits for searching/masking)
  idLast4               String?  @db.VarChar(4)
  phoneLast4            String?  @db.VarChar(4)
  phoneAltLast4         String?  @db.VarChar(4)
  nextOfKinPhoneLast4   String?  @db.VarChar(4)
  
  // ... other fields
  
  @@index([idLast4])
  @@index([phoneLast4])
  @@map("Member")
}
```

## 🧪 Testing Encryption

### 1. Run Migration

```bash
# In Supabase SQL Editor or via psql
psql $DATABASE_URL -f db/prisma/migrations/002_pgcrypto_pii/migration.sql
```

### 2. Set Encryption Key

```sql
-- Set key for current session
SET app.pii_key = 'your-test-key-here';
```

### 3. Test Encryption Functions

```sql
-- Test encryption/decryption
SELECT 
  'Original: 1234567890' as step1,
  enc('1234567890') as step2_encrypted,
  dec(enc('1234567890')) as step3_decrypted,
  mask_last4('1234567890') as step4_masked,
  get_last4('1234567890') as step5_last4;
```

### 4. Insert Test Data

```sql
-- Insert member (will auto-encrypt)
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName",
  email, "idPassportNumber", telephone, "physicalAddress",
  "dateOfBirth", "nextOfKinName", "nextOfKinPhone", 
  "nextOfKinRelationship", "branchId"
)
VALUES (
  'test-enc-001', 'user-enc-001', 'MENC001', 
  'Encrypted', 'Test', 'enc.test@example.com',
  '12345678', '0712345678', 'Test Address',
  '1990-01-01', 'Test Kin', '0733333333',
  'Spouse', 'branch-001'
);
```

### 5. Verify Encryption

```sql
-- Check encrypted data (should see bytea)
SELECT 
  "memberNumber",
  "idNumberEncrypted", -- Should show \x... (encrypted bytes)
  "phoneEncrypted",
  "idLast4",           -- Should show '5678'
  "phoneLast4"         -- Should show '5678'
FROM "Member"
WHERE id = 'test-enc-001';
```

### 6. Test Decryption

```sql
-- Query with decryption (requires key to be set)
SELECT 
  "memberNumber",
  "firstName",
  dec("idNumberEncrypted") as "idDecrypted", -- Should show '12345678'
  dec("phoneEncrypted") as "phoneDecrypted", -- Should show '0712345678'
  "idLast4",
  "phoneLast4"
FROM "Member"
WHERE id = 'test-enc-001';
```

### 7. Test Without Key

```sql
-- Clear key
RESET app.pii_key;

-- Try to decrypt (should fail gracefully)
SELECT 
  "memberNumber",
  dec("idNumberEncrypted") as "idDecrypted", -- Should return NULL
  "idLast4"                                    -- Should still work
FROM "Member"
WHERE id = 'test-enc-001';
```

## 🔒 Security Best Practices

### 1. Key Storage
- ✅ Store in environment variables
- ✅ Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- ❌ Never commit to source control
- ❌ Never log or expose in error messages
- ❌ Never send to client/frontend

### 2. Access Control
```sql
-- Grant minimal permissions
GRANT SELECT ON "Member" TO member_role;
REVOKE SELECT ON "MemberWithDecryptedPII" FROM member_role;
GRANT SELECT ON "MemberWithDecryptedPII" TO admin_role;
```

### 3. Audit Logging
```typescript
// Log all PII access
async function getMemberPII(memberId: string, requestedBy: string) {
  await auditLog.log({
    action: 'PII_ACCESS',
    resource: 'Member',
    resourceId: memberId,
    requestedBy,
    timestamp: new Date(),
  });
  
  return getMemberWithPII(memberId);
}
```

### 4. Data Masking for Regular Users
```typescript
// Return masked data for non-admin users
function getMemberForDisplay(member: Member, userRole: string) {
  if (userRole === 'ADMIN') {
    return member; // Full decrypted data
  }
  
  return {
    ...member,
    idPassportNumber: `****${member.idLast4}`,
    telephone: `****${member.phoneLast4}`,
    // Never expose encrypted fields
    idNumberEncrypted: undefined,
    phoneEncrypted: undefined,
  };
}
```

## 📊 Migration of Existing Data

### Step 1: Set Encryption Key

```bash
export PII_ENCRYPTION_KEY=your-production-key-here
```

### Step 2: Run Migration Script

```sql
-- Connect to database
psql $DATABASE_URL

-- Set key
SET app.pii_key = 'your-production-key-here';

-- Encrypt existing data
UPDATE "Member"
SET
  "idNumberEncrypted" = enc("idPassportNumber"),
  "idLast4" = get_last4("idPassportNumber"),
  "phoneEncrypted" = enc("telephone"),
  "phoneLast4" = get_last4("telephone"),
  "phoneAltEncrypted" = CASE 
    WHEN "telephoneAlt" IS NOT NULL THEN enc("telephoneAlt") 
    ELSE NULL 
  END,
  "phoneAltLast4" = CASE 
    WHEN "telephoneAlt" IS NOT NULL THEN get_last4("telephoneAlt") 
    ELSE NULL 
  END,
  "nextOfKinPhoneEncrypted" = enc("nextOfKinPhone"),
  "nextOfKinPhoneLast4" = get_last4("nextOfKinPhone")
WHERE "idNumberEncrypted" IS NULL;

-- Verify
SELECT 
  COUNT(*) as total,
  COUNT("idNumberEncrypted") as encrypted_ids,
  COUNT("phoneEncrypted") as encrypted_phones
FROM "Member";
```

### Step 3: Gradual Deprecation

```prisma
// Phase 1: Keep both (current)
model Member {
  idPassportNumber      String   // Original
  idNumberEncrypted     Bytes?   // Encrypted
  idLast4               String?  // Display
}

// Phase 2: Make encrypted required (after migration)
model Member {
  idPassportNumber      String   // Deprecated
  idNumberEncrypted     Bytes    // Primary
  idLast4               String   // Display
}

// Phase 3: Remove plain text (future)
model Member {
  // idPassportNumber removed
  idNumberEncrypted     Bytes
  idLast4               String
}
```

## 🚨 Troubleshooting

### Error: "PII encryption key not set"

```typescript
// Solution: Ensure key is set before queries
await client.query(`SET app.pii_key = $1`, [process.env.PII_ENCRYPTION_KEY]);
```

### Error: Decryption returns NULL

```sql
-- Check if key is correct
SELECT get_pii_key(); -- Should return your key

-- Verify data is encrypted
SELECT "idNumberEncrypted" FROM "Member" LIMIT 1; -- Should show \x...

-- Test with known key
SET app.pii_key = 'correct-key';
SELECT dec("idNumberEncrypted") FROM "Member" LIMIT 1;
```

### Performance Issues

```sql
-- Use indexes on last4 columns for searching
CREATE INDEX IF NOT EXISTS idx_member_phone_last4 ON "Member"("phoneLast4");

-- Query with last4 instead of decrypting
SELECT * FROM "Member" WHERE "phoneLast4" = '5678';
-- Instead of: WHERE dec("phoneEncrypted") LIKE '%5678'
```

## 📚 Additional Resources

- [PostgreSQL pgcrypto Documentation](https://www.postgresql.org/docs/current/pgcrypto.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [GDPR Article 32: Security of Processing](https://gdpr-info.eu/art-32-gdpr/)

## ✅ Checklist

Before going to production:

- [ ] Generated strong encryption key (32+ bytes)
- [ ] Stored key securely in environment variables
- [ ] Tested encryption/decryption in development
- [ ] Migrated existing data to encrypted format
- [ ] Updated backend to set session key
- [ ] Configured access controls (RLS policies)
- [ ] Implemented audit logging for PII access
- [ ] Tested key rotation procedure
- [ ] Documented key backup/recovery process
- [ ] Trained team on PII handling
- [ ] Configured monitoring/alerts for encryption errors
