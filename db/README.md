# Database Configuration

This directory contains all database-related code:
- Prisma schema
- SQL migrations
- Seed scripts
- Row Level Security (RLS) policies

## Structure

- `prisma/` - Prisma schema and migrations
- `seeds/` - Database seed scripts
- `sql/` - Custom SQL scripts (RLS policies, functions, triggers)

## Setup

1. Configure your DATABASE_URL in `.env`
2. Run migrations: `pnpm db:migrate`
3. Seed the database: `pnpm db:seed`
