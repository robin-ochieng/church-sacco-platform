-- ============================================
-- PGCrypto PII Encryption Migration - MINIMAL VERSION
-- Run EACH section separately in Supabase SQL Editor
-- Copy and run one section at a time
-- ============================================

-- SECTION 1: Enable Extension
-- Copy and run this first:
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================
-- SECTION 2: Create get_pii_key function
-- Copy and run this second:
-- ============================================
create or replace function get_pii_key()
returns text
language plpgsql
stable security definer
as $$
declare
  v_session_key text;
begin
  begin
    v_session_key := current_setting('app.pii_key', true);
  exception when others then
    v_session_key := null;
  end;
  
  if v_session_key is null or v_session_key = '' then
    begin
      v_session_key := current_setting('pii_encryption_key', true);
    exception when others then
      return null;
    end;
  end if;
  
  return v_session_key;
end;
$$;


-- ============================================
-- SECTION 3: Create enc function
-- Copy and run this third:
-- ============================================
drop function if exists pii_encrypt cascade;
drop function if exists enc cascade;

create function pii_encrypt(p_data text)
returns bytea
language plpgsql
stable
as $$
declare
  v_encryption_key text;
begin
  if p_data is null or p_data = '' then
    return null;
  end if;
  
  v_encryption_key := get_pii_key();
  
  if v_encryption_key is null or v_encryption_key = '' then
    raise exception 'PII encryption key not set. Set app.pii_key at session start.';
  end if;
  
  return pgp_sym_encrypt(p_data, v_encryption_key);
end;
$$;

-- Create alias for backward compatibility
create function enc(p_data text)
returns bytea
language sql
stable
as $$
  select pii_encrypt(p_data);
$$;


-- ============================================
-- SECTION 4: Create dec function
-- Copy and run this fourth:
-- ============================================
drop function if exists pii_decrypt cascade;

create function pii_decrypt(p_encrypted_data bytea)
returns text
language plpgsql
stable
as $$
declare
  v_encryption_key text;
begin
  if p_encrypted_data is null then
    return null;
  end if;
  
  v_encryption_key := get_pii_key();
  
  if v_encryption_key is null or v_encryption_key = '' then
    raise exception 'PII encryption key not set. Set app.pii_key at session start.';
  end if;
  
  return pgp_sym_decrypt(p_encrypted_data, v_encryption_key);
exception
  when others then
    return null;
end;
$$;


-- ============================================
-- SECTION 5: Create mask_last4 function
-- Copy and run this fifth:
-- ============================================
drop function if exists mask_last4(text);

create function mask_last4(p_data text)
returns text
language plpgsql
immutable
as $$
begin
  if p_data is null or p_data = '' then
    return null;
  end if;
  
  if length(p_data) <= 4 then
    return repeat('*', length(p_data));
  end if;
  
  return repeat('*', length(p_data) - 4) || right(p_data, 4);
end;
$$;


-- ============================================
-- SECTION 6: Create get_last4 function
-- Copy and run this sixth:
-- ============================================
drop function if exists get_last4(text);

create function get_last4(p_data text)
returns text
language plpgsql
immutable
as $$
begin
  if p_data is null or p_data = '' then
    return null;
  end if;
  
  if length(p_data) <= 4 then
    return p_data;
  end if;
  
  return right(p_data, 4);
end;
$$;


-- ============================================
-- SECTION 7: Add encrypted columns
-- Copy and run this seventh:
-- ============================================
alter table "Member" add column if not exists "idNumberEncrypted" bytea;
alter table "Member" add column if not exists "phoneEncrypted" bytea;
alter table "Member" add column if not exists "phoneAltEncrypted" bytea;
alter table "Member" add column if not exists "nextOfKinPhoneEncrypted" bytea;


-- ============================================
-- SECTION 8: Add last4 columns
-- Copy and run this eighth:
-- ============================================
alter table "Member" add column if not exists "idLast4" varchar(4);
alter table "Member" add column if not exists "phoneLast4" varchar(4);
alter table "Member" add column if not exists "phoneAltLast4" varchar(4);
alter table "Member" add column if not exists "nextOfKinPhoneLast4" varchar(4);


-- ============================================
-- SECTION 9: Create indexes
-- Copy and run this ninth:
-- ============================================
create index if not exists idx_member_id_last4 on "Member"("idLast4");
create index if not exists idx_member_phone_last4 on "Member"("phoneLast4");
create index if not exists idx_member_phone_alt_last4 on "Member"("phoneAltLast4");
create index if not exists idx_member_next_of_kin_phone_last4 on "Member"("nextOfKinPhoneLast4");


-- ============================================
-- SECTION 10: Create trigger function
-- Copy and run this tenth:
-- ============================================
drop function if exists encrypt_member_pii();

create function encrypt_member_pii()
returns trigger
language plpgsql
as $$
begin
  if new."idPassportNumber" is not null and new."idPassportNumber" != '' then
    new."idNumberEncrypted" := pii_encrypt(new."idPassportNumber");
    new."idLast4" := get_last4(new."idPassportNumber");
  end if;
  
  if new."telephone" is not null and new."telephone" != '' then
    new."phoneEncrypted" := pii_encrypt(new."telephone");
    new."phoneLast4" := get_last4(new."telephone");
  end if;
  
  if new."telephoneAlt" is not null and new."telephoneAlt" != '' then
    new."phoneAltEncrypted" := pii_encrypt(new."telephoneAlt");
    new."phoneAltLast4" := get_last4(new."telephoneAlt");
  end if;
  
  if new."nextOfKinPhone" is not null and new."nextOfKinPhone" != '' then
    new."nextOfKinPhoneEncrypted" := pii_encrypt(new."nextOfKinPhone");
    new."nextOfKinPhoneLast4" := get_last4(new."nextOfKinPhone");
  end if;
  
  return new;
end;
$$;


-- ============================================
-- SECTION 11: Create trigger
-- Copy and run this eleventh:
-- ============================================
drop trigger if exists trigger_encrypt_member_pii on "Member";

create trigger trigger_encrypt_member_pii
  before insert or update on "Member"
  for each row
  execute function encrypt_member_pii();


-- ============================================
-- SECTION 12: Create admin view
-- Copy and run this twelfth:
-- ============================================
create or replace view "MemberWithDecryptedPII" as
select
  m.id,
  m."userId",
  m."memberNumber",
  m."firstName",
  m."lastName",
  m.email,
  m."physicalAddress",
  m."dateOfBirth",
  m."nextOfKinName",
  m."nextOfKinRelationship",
  m."branchId",
  m."createdAt",
  m."updatedAt",
  pii_decrypt(m."idNumberEncrypted") as "idPassportNumber",
  pii_decrypt(m."phoneEncrypted") as "telephone",
  pii_decrypt(m."phoneAltEncrypted") as "telephoneAlt",
  pii_decrypt(m."nextOfKinPhoneEncrypted") as "nextOfKinPhone",
  m."idLast4",
  m."phoneLast4",
  m."phoneAltLast4",
  m."nextOfKinPhoneLast4",
  m."idNumberEncrypted",
  m."phoneEncrypted",
  m."phoneAltEncrypted",
  m."nextOfKinPhoneEncrypted"
from "Member" m;


-- ============================================
-- DONE! Test your encryption
-- ============================================
-- Run these test queries after setting your key:
-- 
-- set app.pii_key = 'test-key-123';
-- select pii_encrypt('test-data');
-- select pii_decrypt(pii_encrypt('test-data'));
-- select enc('test-data');  -- alias test
-- select dec(enc('test-data'));  -- alias test
-- select mask_last4('1234567890');
-- select get_last4('1234567890');
