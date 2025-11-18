# Supabase Quick Reference

## 🔑 Environment Variables Needed

### Get from Supabase Dashboard > Settings > API:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### Get from Supabase Dashboard > Settings > Database:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

## 📝 Where to Add Variables

### `db/.env`
```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

### `apps/api/.env`
```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

### `apps/web/.env`
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 🚀 Setup Steps

1. Create Supabase project at https://supabase.com
2. Copy all keys from dashboard
3. Update the 3 `.env` files above
4. Run setup:
   ```bash
   pnpm install
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```

## 💡 Usage

### In API (NestJS)
```typescript
// Prisma for database
constructor(private prisma: PrismaService) {}
const members = await this.prisma.member.findMany();

// Supabase for auth/storage
constructor(private supabase: SupabaseService) {}
const client = this.supabase.getClient();
```

### In Web (Next.js)
```typescript
// Supabase client
import { supabase } from '@/lib/supabase-client';
const { data } = await supabase.auth.signIn({ email, password });
```

## 📚 Documentation
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Step-by-step setup
- [SUPABASE_INTEGRATION.md](./SUPABASE_INTEGRATION.md) - Technical details
- [README.md](./README.md) - General project info

## ⚠️ Security
- ✅ `ANON_KEY` - Safe in browser
- ❌ `SERVICE_ROLE_KEY` - Backend only!
- ❌ `DATABASE_URL` - Backend only!
