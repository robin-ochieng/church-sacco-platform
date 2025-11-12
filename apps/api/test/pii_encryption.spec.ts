import { Pool } from 'pg';
import { randomUUID } from 'crypto';

describe('PII encryption via pgcrypto', () => {
  const piiKey = process.env.PII_ENCRYPTION_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  let pool: Pool;

  if (!piiKey) {
    throw new Error('PII_ENCRYPTION_KEY must be defined for PII encryption tests');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be defined for PII encryption tests');
  }

  beforeAll(() => {
    pool = new Pool({ connectionString: databaseUrl });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('encrypts sensitive fields and exposes decrypted values through the admin view', async () => {
    const memberId = randomUUID();
    const userId = randomUUID();
    const now = new Date().toISOString();

    const client = await pool.connect();
    try {
      await client.query('SET app.pii_key = $1', [piiKey]);

      const email = `${memberId.slice(0, 8)}@example.com`;
      const idNumber = 'A123456789';
      const phone = '0712345678';
      const phoneAlt = '0798765432';
      const kinPhone = '0700111222';

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
           email,
           "idPassportNumber",
           "physicalAddress",
           telephone,
           "telephoneAlt",
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
           $4,
           $5,
           'Test Address',
           $6,
           $7,
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
