# ACK Thiboro SACCO Platform

A modern, full-stack monorepo for managing ACK Thiboro SACCO operations, built with TypeScript, Next.js, NestJS, and Prisma.

## 🏗️ Project Structure

```
church-sacco-platform/
├── apps/
│   ├── api/              # NestJS backend API
│   └── web/              # Next.js frontend (App Router)
├── db/                   # Database schemas, migrations, and seeds
│   ├── prisma/           # Prisma schema
│   ├── seeds/            # Database seed scripts
│   └── sql/              # Custom SQL (RLS policies, functions)
├── packages/
│   └── config/           # Shared ESLint, Prettier, and TypeScript configs
├── .github/
│   └── workflows/        # CI/CD workflows
├── .husky/               # Git hooks
├── package.json          # Root package with workspaces
├── pnpm-workspace.yaml   # PNPM workspace configuration
└── turbo.json            # Turborepo configuration
```

## ✨ Features

- 🚀 **Monorepo** - Managed with pnpm workspaces and Turborepo
- 📦 **TypeScript** - Strict mode enabled across all packages
- 🎨 **Next.js 14** - App Router with React Server Components
- 🔥 **NestJS** - Scalable Node.js framework for the API
- 🗄️ **Prisma** - Type-safe database ORM
- 🎯 **Tailwind CSS** - Utility-first CSS framework
- 🧪 **Testing** - Jest configuration ready
- 📏 **Code Quality** - ESLint, Prettier, Husky, and lint-staged
- 🔒 **Git Hooks** - Pre-commit linting and conventional commits
- ⚡ **CI/CD** - GitHub Actions workflows

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Supabase account (free tier available at [supabase.com](https://supabase.com))

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/robin-ochieng/church-sacco-platform.git
cd church-sacco-platform
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up Supabase Database**

See detailed instructions in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

Quick steps:
- Create a Supabase project at [supabase.com](https://supabase.com)
- Get your database connection string from Dashboard > Settings > Database
- Update DATABASE_URL in `db/.env` and `apps/api/.env`

```bash
# Copy example env files
cp db/.env.example db/.env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Update the DATABASE_URL in db/.env and apps/api/.env with your Supabase connection string
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

4. **Initialize the database**

You can use the automated setup script:

**Windows (PowerShell):**
```powershell
.\setup-supabase.ps1
```

**Mac/Linux:**
```bash
chmod +x setup-supabase.sh
./setup-supabase.sh
```

Or run commands manually:
```bash
pnpm db:generate    # Generate Prisma Client
pnpm db:migrate     # Run migrations
pnpm db:seed        # Seed initial data
```

5. **Set up Git hooks**

```bash
pnpm prepare
```

## 🛠️ Development

### Run all apps in development mode

```bash
pnpm dev
```

This will start:
- API server on http://localhost:4000
- Web app on http://localhost:3000

### Run individual apps

```bash
# API only
cd apps/api
pnpm dev

# Web only
cd apps/web
pnpm dev
```

### Available Scripts

```bash
pnpm dev          # Run all apps in development mode
pnpm build        # Build all apps
pnpm test         # Run tests across all packages
pnpm lint         # Lint all packages
pnpm typecheck    # Type check all packages
pnpm format       # Format code with Prettier
pnpm format:check # Check code formatting

# Database shortcuts (can be run from root)
pnpm db:generate  # Generate Prisma Client
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed database
pnpm db:studio    # Open Prisma Studio
pnpm db:reset     # Reset database (CAUTION)
```

## 📦 Database Management with Supabase

All database commands can be run from the project root:

```bash
# Generate Prisma Client
pnpm db:generate

# Create and apply migrations to Supabase
pnpm db:migrate

# Seed the database with initial data
pnpm db:seed

# Open Prisma Studio to view/edit data
pnpm db:studio

# Reset database (CAUTION: deletes all data)
pnpm db:reset
```

**Viewing your data in Supabase:**
- Visit your Supabase Dashboard
- Click "Table Editor" to see all tables
- Use SQL Editor for custom queries

**Connection Pooling for Production:**
When deploying, use Supabase's connection pooling URL for better performance:
```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for specific app
cd apps/api
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:cov
```

## 📝 Code Quality

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific app
cd apps/web
pnpm lint
```

### Formatting

```bash
# Format all files
pnpm format

# Check formatting
pnpm format:check
```

### Git Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix a bug
docs: update documentation
style: format code
refactor: refactor code
perf: improve performance
test: add tests
build: update build scripts
ci: update CI configuration
chore: other changes
```

## 🏗️ Building for Production

```bash
# Build all apps
pnpm build

# Build specific app
cd apps/api
pnpm build
```

## 🚢 Deployment

### API Deployment

```bash
cd apps/api
pnpm build
pnpm start:prod
```

### Web Deployment

```bash
cd apps/web
pnpm build
pnpm start
```

## 📚 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **TanStack Query** - Server state management
- **Zod** - Schema validation
- **Axios** - HTTP client

### Backend
- **NestJS** - Node.js framework
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **Passport JWT** - Authentication
- **bcrypt** - Password hashing
- **class-validator** - DTO validation

### DevOps & Tooling
- **pnpm** - Package manager
- **Turborepo** - Build system
- **TypeScript** - Type safety
- **ESLint** - Linting
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **lint-staged** - Run linters on staged files
- **commitlint** - Conventional commits

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes using conventional commits (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Robin Ochieng** - Initial work - [robin-ochieng](https://github.com/robin-ochieng)

## 🙏 Acknowledgments

- Church SACCO community
- Open source contributors
- All contributors to the libraries used in this project
