# Supabase Setup Guide

This guide will help you set up Supabase as your PostgreSQL database for the Church SACCO Platform.

## 1. Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign In"
3. Sign up with GitHub, Google, or email

## 2. Create a New Project

1. Click "New Project" from your dashboard
2. Fill in the project details:
   - **Name**: `church-sacco-platform` (or your preferred name)
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose the region closest to you or your users
   - **Pricing Plan**: Free tier is sufficient for development

3. Click "Create new project"
4. Wait 2-3 minutes for Supabase to set up your database

## 3. Get Your Supabase Credentials

Once your project is ready, you need to get three important credentials:

### A. API Keys (Settings > API)

1. Click on the **"Settings"** icon (⚙️) in the left sidebar
2. Click on **"API"**
3. You'll see:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **Anon (public) key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (safe for client-side)
   - **Service role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (NEVER expose in client!)

**Copy all three values - you'll need them!**

### B. Database Connection String (Settings > Database)

1. Still in Settings, click on **"Database"**
2. Scroll down to **"Connection string"** section
3. Select **"URI"** tab
4. Copy the connection string:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   ```

**Important:** Replace `[YOUR-PASSWORD]` with the actual password you set when creating the project!

## 4. Connection Pooling (Recommended for Production)

For better performance, especially in serverless environments:

1. In the same Database settings page, look for **"Connection Pooling"**
2. Select **"Transaction"** mode
3. Copy the connection pooling string - it looks like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

## 5. Update Your Environment Variables

You need to update the environment files with your Supabase credentials:

### For Database Operations (`db/.env`)

```env
# Supabase API Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database URL for Prisma
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"
```

### For API Backend (`apps/api/.env`)

```env
NODE_ENV=development
PORT=4000

# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database URL for Prisma
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=7d

# CORS
FRONTEND_URL=http://localhost:3000
```

### For Web Frontend (`apps/web/.env`)

```env
# API Backend
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Supabase Configuration (Public keys - safe for client)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important Security Notes:**
- ✅ `SUPABASE_ANON_KEY` is safe to expose in the browser (public key)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed in client code
- ❌ Only use `SERVICE_ROLE_KEY` in backend/server code

## 6. Run Migrations

After updating your `.env` files:

```bash
# Navigate to your project root
cd church-sacco-platform

# Generate Prisma Client
pnpm --filter @church-sacco/db db:generate

# Run migrations to create tables
pnpm --filter @church-sacco/db db:migrate

# Seed the database with initial data
pnpm --filter @church-sacco/db db:seed
```

## 7. Verify Connection

You can verify your database connection using Prisma Studio:

```bash
pnpm --filter @church-sacco/db db:studio
```

Or visit your Supabase Dashboard:
1. Go to **"Table Editor"** in the left sidebar
2. You should see all your tables created by Prisma

## 8. Additional Supabase Features (Optional)

Once your database is set up, you can explore additional Supabase features:

### Authentication
- Supabase provides built-in authentication
- Can integrate with your NestJS API

### Storage
- For uploading member documents, profile pictures, etc.

### Real-time
- Real-time subscriptions for live updates

### Edge Functions
- Serverless functions for custom logic

## Security Best Practices

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Use environment variables** in production (Vercel, Railway, etc.)
3. **Rotate passwords** periodically
4. **Enable Row Level Security (RLS)** in Supabase for production
5. **Set up database backups** in Supabase settings

## Troubleshooting

### Connection Issues
- Verify your password is correct (no special characters causing issues)
- Check your internet connection
- Ensure the Supabase project is not paused (free tier limitation)

### Migration Errors
- Make sure you're using the correct DATABASE_URL
- Check if tables already exist (drop them if needed)
- Review Prisma schema for any syntax errors

### Performance Issues
- Use connection pooling for production
- Add indexes to frequently queried fields
- Monitor database usage in Supabase dashboard

## Next Steps

Once your database is set up:

1. Restart your development servers: `pnpm dev`
2. The API should now connect successfully
3. Start building your Church SACCO features!

## Support

- **Supabase Documentation**: https://supabase.com/docs
- **Prisma Documentation**: https://www.prisma.io/docs
- **Community Support**: Supabase Discord & GitHub Discussions
