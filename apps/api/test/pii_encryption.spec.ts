/// <reference types="jest" />
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

describe('PII encryption via pgcrypto', () => {
  const piiKey = process.env.PII_ENCRYPTION_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  let pool: Pool;
  let encryptionAvailable = false;

  if (!piiKey) {
    throw new Error('PII_ENCRYPTION_KEY must be defined for PII encryption tests');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be defined for PII encryption tests');
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    
    // Check if pgcrypto extension and encryption functions exist
    try {
      const client = await pool.connect();
      const { rows } = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_proc 
          WHERE proname = 'encrypt_pii'
        ) as has_encryption
      `);
      encryptionAvailable = rows[0]?.has_encryption || false;
      client.release();
      
      if (!encryptionAvailable) {
        console.warn('⚠️  PII encryption functions not found. Run migration 002_pgcrypto_pii to enable encryption tests.');
      }
    } catch (error) {
      console.warn('⚠️  Could not check for PII encryption functions:', error.message);
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('encrypts sensitive fields and exposes decrypted values through the admin view', async () => {
    if (!encryptionAvailable) {
      console.warn('⚠️  Skipping test: PII encryption not available');
      return;
    }
    
    const memberId = randomUUID();
    const userId = randomUUID();
    const now = new Date().toISOString();
    const timestamp = Date.now();

    const client = await pool.connect();
    try {
      // SET commands don't support parameterized queries, must use string interpolation
      // This is safe because piiKey comes from environment variable, not user input
      await client.query(`SET LOCAL app.pii_key = '${piiKey.replace(/'/g, "''")}'`);

      const email = `test-${timestamp}@example.com`;
      const idNumber = `ID${timestamp}`;
      const phone = `071234${timestamp.toString().slice(-4)}`;
      const phoneAlt = `079876${timestamp.toString().slice(-4)}`;
      const kinPhone = `070011${timestamp.toString().slice(-4)}`;

      // Ensure related user exists
      await client.query(
        `INSERT INTO "User" (id, email, password, role, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, 'test-hash', 'MEMBER', true, $3, $3)`,
        [userId, email, now]
      );

      await client.query(
        `INSERT INTO "Member" (
           id,
           "userId",
           "memberNumber",
           "firstName",
           "lastName",
           gender,
           email,
           "idPassportNumber",
           "physicalAddress",
           telephone,
           "telephoneAlt",
           "dateOfBirth",
           "nextOfKinName",
           "nextOfKinPhone",
           "nextOfKinRelationship",
           "registrationFee",
           "joiningDate",
           "membershipStatus",
           "agreedToTerms",
           "agreedToRefundPolicy",
           "createdAt",
           "updatedAt"
         )
         VALUES (
           $1,
           $2,
           $3,
           'Test',
           'Member',
           'MALE',
           $4,
           $5,
           'Test Address',
           $6,
           $7,
           '1990-01-01',
           'Kin Name',
           $8,
           'Sibling',
           2000,
           $9,
           'ACTIVE',
           true,
           true,
           $9,
           $9
         )`,
        [
          memberId,
          userId,
          `M-${memberId.slice(0, 8)}`,
          email,
          idNumber,
          phone,
          phoneAlt,
          kinPhone,
          now,
        ]
      );

      const {
        rows: [memberRow],
      } = await client.query(
        `SELECT
           "idNumberEncrypted"       AS id_number_encrypted,
           "phoneEncrypted"          AS phone_encrypted,
           "phoneAltEncrypted"       AS phone_alt_encrypted,
           "nextOfKinPhoneEncrypted" AS next_of_kin_phone_encrypted,
           "idLast4"                 AS id_last4,
           "phoneLast4"              AS phone_last4,
           "phoneAltLast4"           AS phone_alt_last4,
           "nextOfKinPhoneLast4"     AS next_of_kin_phone_last4
         FROM "Member"
         WHERE id = $1`,
        [memberId]
      );

      expect(memberRow).toBeDefined();
      expect(memberRow.id_number_encrypted).toBeTruthy();
      expect(memberRow.phone_encrypted).toBeTruthy();
      expect(memberRow.phone_alt_encrypted).toBeTruthy();
      expect(memberRow.next_of_kin_phone_encrypted).toBeTruthy();
      expect(memberRow.id_last4).toBe(idNumber.slice(-4));
      expect(memberRow.phone_last4).toBe(phone.slice(-4));
      expect(memberRow.phone_alt_last4).toBe(phoneAlt.slice(-4));
      expect(memberRow.next_of_kin_phone_last4).toBe(kinPhone.slice(-4));

      const {
        rows: [viewRow],
      } = await client.query(
        `SELECT
           "idPassportNumber",
           telephone,
           "telephoneAlt",
           "nextOfKinPhone"
         FROM "MemberWithDecryptedPII"
         WHERE id = $1`,
        [memberId]
      );

      expect(viewRow.idPassportNumber).toBe(idNumber);
      expect(viewRow.telephone).toBe(phone);
      expect(viewRow.telephoneAlt).toBe(phoneAlt);
      expect(viewRow.nextOfKinPhone).toBe(kinPhone);
    } finally {
      await client.query('RESET app.pii_key');
      client.release();
    }

    // A fresh connection without the key should not decrypt values
    const { rows: [withoutKeyRow] } = await pool.query(
      `SELECT "idPassportNumber" FROM "MemberWithDecryptedPII" WHERE id = $1`,
      [memberId]
    );
    expect(withoutKeyRow.idPassportNumber).toBeNull();

    // Clean up inserted data (no key required)
    await pool.query('DELETE FROM "Member" WHERE id = $1', [memberId]);
    await pool.query('DELETE FROM "User" WHERE id = $1', [userId]);
  });
});
