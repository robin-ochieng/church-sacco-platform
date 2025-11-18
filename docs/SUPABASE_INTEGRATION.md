# Supabase Integration Guide

This document explains how Supabase is integrated into the Church SACCO Platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Supabase Cloud                     │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  PostgreSQL Database                     │  │
│  │  - users, members, loans, savings, etc.  │  │
│  └──────────────────────────────────────────┘  │
│           ▲                    ▲                │
│           │ (SQL/Prisma)       │ (Supabase SDK) │
└───────────┼────────────────────┼────────────────┘
            │                    │
            │                    │
    ┌───────┴────────┐   ┌──────┴────────┐
    │  Prisma ORM    │   │  Supabase JS  │
    │  - Migrations  │   │  - Auth       │
    │  - Type-safe   │   │  - Storage    │
    │  - Queries     │   │  - Realtime   │
    └───────┬────────┘   └──────┬────────┘
            │                    │
    ┌───────▼────────┐   ┌──────▼────────┐
    │  NestJS API    │   │  Next.js Web  │
    │  (Port 4000)   │   │  (Port 3000)  │
    └────────────────┘   └───────────────┘
```

## Two Ways to Access Database

### 1. Prisma ORM (Recommended for Business Logic)

**Used for:**
- CRUD operations
- Complex queries
- Database migrations
- Type-safe database access

**Location:** `apps/api/src/prisma/prisma.service.ts`

**Example:**
```typescript
// In any service
constructor(private prisma: PrismaService) {}

async getMembers() {
  return this.prisma.member.findMany({
    include: { user: true }
  });
}
```

### 2. Supabase SDK (Recommended for Auth, Storage, Realtime)

**Used for:**
- User authentication
- File storage
- Real-time subscriptions
- Row Level Security

**Locations:**
- API: `apps/api/src/supabase/supabase.service.ts`
- Web: `apps/web/src/lib/supabase-client.ts`

**Example (API):**
```typescript
// In any service
constructor(private supabase: SupabaseService) {}

async signUp(email: string, password: string) {
  const { data, error } = await this.supabase
    .getClient()
    .auth.signUp({ email, password });
  
  return { data, error };
}
```

**Example (Web):**
```typescript
import { supabase } from '@/lib/supabase-client';

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

// Real-time subscription
supabase
  .channel('loans')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'loans' },
    (payload) => console.log('New loan:', payload)
  )
  .subscribe();
```

## Environment Variables Explained

### Backend (API) Variables

```env
# Supabase SDK Configuration
SUPABASE_URL=https://xxxxx.supabase.co        # Your project URL
SUPABASE_ANON_KEY=eyJhbG...                   # Public key (safe)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...           # Admin key (secret!)

# Prisma Database Connection
DATABASE_URL=postgresql://postgres:...         # Direct connection
```

**Why both?**
- `SUPABASE_URL` + `SUPABASE_ANON_KEY`: For Supabase SDK features (auth, storage)
- `SUPABASE_SERVICE_ROLE_KEY`: For admin operations (bypasses RLS)
- `DATABASE_URL`: For Prisma to run migrations and queries

### Frontend (Web) Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

**Why public?**
- These are safe to expose in browser
- Anon key has limited permissions
- Protected by Row Level Security (RLS)

## When to Use What?

### Use Prisma When:
✅ Performing CRUD operations on your tables
✅ Running complex queries with joins
✅ Need type-safety and autocompletion
✅ Building business logic
✅ Managing database schema

**Example:**
```typescript
// Get member with all their loans
const member = await prisma.member.findUnique({
  where: { id: memberId },
  include: {
    loans: true,
    savings: true,
    shares: true
  }
});
```

### Use Supabase SDK When:
✅ Handling user authentication
✅ Uploading/downloading files
✅ Real-time updates needed
✅ Using Row Level Security
✅ Calling Supabase Edge Functions

**Example:**
```typescript
// User authentication
const { data: { user } } = await supabase.auth.getUser();

// Upload member document
const { data, error } = await supabase
  .storage
  .from('documents')
  .upload('member-id/document.pdf', file);

// Listen to loan updates
supabase
  .channel('loans')
  .on('postgres_changes', { ... })
  .subscribe();
```

## Available Services

### In NestJS API

1. **PrismaService** - Database operations
   ```typescript
   constructor(private prisma: PrismaService) {}
   ```

2. **SupabaseService** - Auth, Storage, Realtime
   ```typescript
   constructor(private supabase: SupabaseService) {}
   
   // Regular client (respects RLS)
   const client = this.supabase.getClient();
   
   // Admin client (bypasses RLS)
   const admin = this.supabase.getAdminClient();
   ```

### In Next.js Web

1. **Supabase Client** - Direct access
   ```typescript
   import { supabase } from '@/lib/supabase-client';
   
   // Auth
   await supabase.auth.signIn({ email, password });
   
   // Query (must respect RLS)
   const { data } = await supabase
     .from('members')
     .select('*')
     .eq('id', userId);
   ```

2. **API Client** - Call your backend
   ```typescript
   import { apiClient } from '@/lib/api-client';
   
   // Uses your NestJS API
   const members = await apiClient.get('/members');
   ```

## Security Considerations

### Row Level Security (RLS)

When using Supabase SDK directly, queries respect RLS policies:

```sql
-- Example RLS policy
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING (auth.uid() = id);
```

### Service Role Key

The `SUPABASE_SERVICE_ROLE_KEY`:
- ⚠️ Bypasses ALL security rules
- ⚠️ Full database access
- ✅ Only use in backend
- ✅ Never expose in client code

### Best Practices

1. **Authentication Flow:**
   ```
   User → Web App → Supabase Auth → Get JWT
   User → Web App → API (with JWT) → Validate → Prisma
   ```

2. **Data Access:**
   - **Public data**: Supabase SDK with RLS
   - **Business logic**: API with Prisma
   - **Admin operations**: Service role key

3. **File Uploads:**
   ```
   User → Web → Supabase Storage → Get URL → API → Save URL in DB
   ```

## Common Patterns

### Pattern 1: Sign Up + Create Member

```typescript
// API endpoint
async signUpMember(dto: SignUpDto) {
  // 1. Create auth user in Supabase
  const { data: authUser } = await this.supabase
    .getAdminClient()
    .auth.admin.createUser({
      email: dto.email,
      password: dto.password,
    });

  // 2. Create user record with Prisma
  const user = await this.prisma.user.create({
    data: {
      id: authUser.user.id,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash: await bcrypt.hash(dto.password, 10),
    },
  });

  // 3. Create member record
  const member = await this.prisma.member.create({
    data: {
      userId: user.id,
      memberNumber: this.generateMemberNumber(),
    },
  });

  return { user, member };
}
```

### Pattern 2: Upload Document

```typescript
// Web component
async uploadDocument(file: File, memberId: string) {
  // 1. Upload to Supabase Storage
  const { data, error } = await supabase
    .storage
    .from('documents')
    .upload(`${memberId}/${file.name}`, file);

  // 2. Save file URL to database via API
  await apiClient.post('/documents', {
    memberId,
    fileName: file.name,
    fileUrl: data.path,
  });
}
```

### Pattern 3: Real-time Loan Updates

```typescript
// Web component
useEffect(() => {
  const channel = supabase
    .channel('loan-updates')
    .on(
      'postgres_changes',
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'loans',
        filter: `memberId=eq.${currentMemberId}`
      },
      (payload) => {
        // Update UI when loan status changes
        setLoan(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [currentMemberId]);
```

## Installation Commands

The packages have been added to package.json. Install them:

```bash
# Install all dependencies
pnpm install
```

This installs:
- `@supabase/supabase-js` in both API and Web apps
- Provides full Supabase SDK functionality

## Testing Connection

After setting up your environment variables:

```bash
# Generate Prisma client
pnpm db:generate

# Test database connection
pnpm db:migrate

# Start development servers
pnpm dev
```

Both Prisma and Supabase will connect to your Supabase database!

## Troubleshooting

### Issue: "Cannot find module '@supabase/supabase-js'"
**Solution:** Run `pnpm install` to install dependencies

### Issue: Auth user created but no user record
**Solution:** Ensure you're creating both auth user AND database record

### Issue: RLS blocks queries
**Solution:** 
- Use service role key in API for admin operations
- Set up proper RLS policies
- Or disable RLS for development (not recommended)

### Issue: Real-time not working
**Solution:**
- Enable Realtime in Supabase dashboard (Database > Replication)
- Check your subscription code
- Verify auth token is set

## Next Steps

1. ✅ Set up Supabase project
2. ✅ Update environment variables
3. ✅ Run `pnpm install`
4. ✅ Run `pnpm db:migrate`
5. 🔨 Implement authentication
6. 🔨 Set up file storage
7. 🔨 Add real-time features
8. 🔨 Configure RLS policies

Happy coding! 🚀
