# System Architecture

## Overview

The Church SACCO Platform is a full-stack monorepo application designed to manage church savings and credit cooperative operations. The system follows a modern three-tier architecture with clear separation of concerns and robust security measures.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Application<br/>Next.js 14<br/>React Server Components<br/>Tailwind CSS]
    end

    subgraph "API Layer"
        API[REST API<br/>NestJS<br/>TypeScript<br/>JWT Auth]
        AUTH[Authentication Module<br/>Guards & Strategies]
        MEMBERS[Members Module]
        LOANS[Loans Module]
        SHARES[Shares Module]
        TRANSACTIONS[Transactions Module]
    end

    subgraph "Data Layer"
        PRISMA[Prisma ORM<br/>Type-safe queries<br/>Migrations]
        SUPABASE[(Supabase PostgreSQL<br/>Row Level Security<br/>PII Encryption<br/>Audit Logs)]
    end

    subgraph "External Services"
        MPESA[M-Pesa API<br/>STK Push<br/>C2B Payments<br/>Withdrawals]
    end

    subgraph "Security & Compliance"
        RLS[Row Level Security<br/>Role-based Access]
        ENCRYPT[PII Encryption<br/>pgcrypto]
        AUDIT[Audit Trail<br/>Triggers & Logs]
    end

    WEB -->|HTTP/REST| API
    API --> AUTH
    API --> MEMBERS
    API --> LOANS
    API --> SHARES
    API --> TRANSACTIONS
    
    AUTH --> PRISMA
    MEMBERS --> PRISMA
    LOANS --> PRISMA
    SHARES --> PRISMA
    TRANSACTIONS --> PRISMA
    
    PRISMA -->|SQL| SUPABASE
    
    SUPABASE --> RLS
    SUPABASE --> ENCRYPT
    SUPABASE --> AUDIT
    
    TRANSACTIONS -->|Payment Integration| MPESA
    API -.->|Webhook Callbacks| MPESA

    classDef client fill:#61dafb,stroke:#333,stroke-width:2px,color:#000
    classDef api fill:#e0234e,stroke:#333,stroke-width:2px,color:#fff
    classDef data fill:#2d3748,stroke:#333,stroke-width:2px,color:#fff
    classDef external fill:#00c853,stroke:#333,stroke-width:2px,color:#fff
    classDef security fill:#ff9800,stroke:#333,stroke-width:2px,color:#000

    class WEB client
    class API,AUTH,MEMBERS,LOANS,SHARES,TRANSACTIONS api
    class PRISMA,SUPABASE data
    class MPESA external
    class RLS,ENCRYPT,AUDIT security
```

## Component Details

### 1. Client Layer (Web Application)

**Technology Stack:**
- **Framework:** Next.js 14 with App Router
- **UI Library:** React 18 with Server Components
- **Styling:** Tailwind CSS for responsive design
- **State Management:** React Context + Server Actions
- **Type Safety:** TypeScript

**Key Features:**
- Server-side rendering for optimal performance
- Progressive Web App (PWA) capabilities
- Responsive design for mobile and desktop
- Real-time updates via Server-Sent Events

**Location:** `apps/web/`

### 2. API Layer (Backend Services)

**Technology Stack:**
- **Framework:** NestJS (Node.js framework)
- **Language:** TypeScript
- **Authentication:** JWT + Passport.js
- **Validation:** class-validator, class-transformer
- **Documentation:** Swagger/OpenAPI

**Modules:**

#### Authentication Module
- JWT-based authentication
- Role-based access control (RBAC)
- Session management
- Password hashing with bcrypt

#### Members Module
- Member registration and profile management
- KYC verification
- Member search and filtering
- PII data handling

#### Loans Module
- Loan application processing
- Approval workflows
- Repayment tracking
- Interest calculation

#### Shares Module
- Share purchase and management
- Dividend calculations
- Share transfer handling

#### Transactions Module
- Payment processing
- Transaction history
- Receipt generation
- M-Pesa integration

**Location:** `apps/api/`

### 3. Data Layer

#### Prisma ORM
- Type-safe database queries
- Schema migrations
- Seed data management
- Query optimization

**Features:**
- Automatic TypeScript type generation
- Migration versioning
- Connection pooling
- Transaction support

#### Supabase PostgreSQL
- Hosted PostgreSQL database
- Real-time subscriptions
- Automatic API generation
- Built-in authentication

**Location:** `db/`

### 4. External Services

#### M-Pesa Integration

**Capabilities:**
- **STK Push:** Initiate payment requests to user phones
- **C2B Payments:** Receive customer-to-business payments
- **B2C Withdrawals:** Disburse loan amounts and dividends
- **Transaction Queries:** Check payment status
- **Webhook Callbacks:** Handle payment confirmations

**Implementation:**
- Secure API key management
- Retry mechanisms for failed transactions
- Transaction reconciliation
- Callback URL validation

### 5. Security & Compliance

#### Row Level Security (RLS)
- Database-level access control
- User role enforcement
- Multi-tenancy support
- Query-level filtering

**Policies:**
```sql
-- Example: Members can only view their own records
CREATE POLICY member_read_own 
ON members FOR SELECT 
USING (auth.uid() = user_id);
```

#### PII Encryption
- Sensitive data encryption at rest
- pgcrypto extension
- Encrypted fields: phone numbers, ID numbers, bank accounts
- Secure key management

**Encrypted Fields:**
- Phone numbers
- National ID numbers
- Bank account numbers
- Postal addresses

#### Audit Trail
- Automatic logging of all data changes
- Trigger-based audit system
- Immutable audit logs
- Compliance reporting

**Tracked Events:**
- Member registrations
- Loan applications and approvals
- Financial transactions
- Profile updates
- Administrative actions

## Data Flow

### 1. User Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Web
    participant API
    participant DB

    User->>Web: Enter credentials
    Web->>API: POST /auth/login
    API->>DB: Verify credentials
    DB-->>API: User data
    API->>API: Generate JWT
    API-->>Web: JWT token + user info
    Web->>Web: Store token (httpOnly cookie)
    Web-->>User: Redirect to dashboard
```

### 2. Transaction Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant Web
    participant API
    participant DB
    participant MPesa

    User->>Web: Initiate payment
    Web->>API: POST /transactions/deposit
    API->>API: Validate request
    API->>MPesa: STK Push request
    MPesa-->>User: Payment prompt on phone
    User->>MPesa: Enter PIN
    MPesa->>API: Webhook callback
    API->>DB: Update transaction status
    API->>DB: Update member balance
    DB-->>API: Confirmation
    API-->>Web: Success notification
    Web-->>User: Receipt & updated balance
```

### 3. Loan Application Flow

```mermaid
sequenceDiagram
    participant Member
    participant Web
    participant API
    participant DB
    participant Admin

    Member->>Web: Submit loan application
    Web->>API: POST /loans/apply
    API->>DB: Create loan record (PENDING)
    API->>DB: Log audit trail
    DB-->>API: Loan ID
    API-->>Web: Application submitted
    
    Admin->>Web: Review applications
    Web->>API: GET /loans/pending
    API->>DB: Fetch pending loans
    DB-->>API: Loan list
    API-->>Web: Display loans
    
    Admin->>Web: Approve loan
    Web->>API: PATCH /loans/:id/approve
    API->>DB: Update loan status (APPROVED)
    API->>MPesa: Initiate disbursement
    MPesa-->>API: Disbursement callback
    API->>DB: Update disbursement status
    API-->>Web: Confirmation
    Web-->>Member: Notification
```

## Deployment Architecture

```mermaid
graph LR
    subgraph "Production Environment"
        VERCEL[Vercel<br/>Next.js Hosting<br/>CDN + Edge Functions]
        RENDER[Render<br/>NestJS API<br/>Docker Container]
        SUPA[Supabase Cloud<br/>PostgreSQL<br/>Backups]
    end

    subgraph "CI/CD"
        GITHUB[GitHub Actions<br/>Automated Testing<br/>Deployment]
    end

    subgraph "Monitoring"
        LOGS[Logging<br/>Error Tracking]
        METRICS[Performance<br/>Monitoring]
    end

    GITHUB -->|Deploy| VERCEL
    GITHUB -->|Deploy| RENDER
    VERCEL <-->|API Calls| RENDER
    RENDER <-->|Database| SUPA
    
    VERCEL --> LOGS
    RENDER --> LOGS
    VERCEL --> METRICS
    RENDER --> METRICS

    classDef deploy fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff
    classDef cicd fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff
    classDef monitor fill:#FF9800,stroke:#333,stroke-width:2px,color:#000

    class VERCEL,RENDER,SUPA deploy
    class GITHUB cicd
    class LOGS,METRICS monitor
```

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 | React framework with SSR |
| | React 18 | UI component library |
| | Tailwind CSS | Utility-first styling |
| | TypeScript | Type safety |
| **Backend** | NestJS | Node.js framework |
| | Passport.js | Authentication |
| | class-validator | Input validation |
| | TypeScript | Type safety |
| **Database** | PostgreSQL | Relational database |
| | Prisma | ORM and migrations |
| | Supabase | Database hosting |
| **Security** | JWT | Token-based auth |
| | bcrypt | Password hashing |
| | pgcrypto | PII encryption |
| | RLS | Row-level security |
| **External** | M-Pesa API | Payment processing |
| **DevOps** | pnpm | Package management |
| | Turborepo | Monorepo tooling |
| | Docker | Containerization |
| | GitHub Actions | CI/CD |

## Security Measures

### 1. Authentication & Authorization
- JWT tokens with expiration
- Role-based access control (Admin, Staff, Member)
- Secure password hashing
- Session management

### 2. Data Protection
- PII encryption at rest
- HTTPS/TLS in transit
- Row-level security policies
- Input validation and sanitization

### 3. Audit & Compliance
- Comprehensive audit logging
- Immutable audit trails
- Transaction tracking
- Compliance reporting

### 4. API Security
- Rate limiting
- CORS configuration
- Request validation
- SQL injection prevention

## Development Workflow

```mermaid
graph LR
    DEV[Local Development<br/>pnpm dev]
    TEST[Testing<br/>Jest + E2E]
    COMMIT[Git Commit<br/>Commitlint]
    PR[Pull Request<br/>Review]
    CI[CI Pipeline<br/>Tests + Lint]
    DEPLOY[Deployment<br/>Staging/Prod]

    DEV --> TEST
    TEST --> COMMIT
    COMMIT --> PR
    PR --> CI
    CI --> DEPLOY

    classDef devstage fill:#4CAF50,stroke:#333,stroke-width:2px
    classDef teststage fill:#2196F3,stroke:#333,stroke-width:2px
    classDef deploystage fill:#FF5722,stroke:#333,stroke-width:2px

    class DEV,COMMIT devstage
    class TEST,CI teststage
    class PR,DEPLOY deploystage
```

## Folder Structure

```
church-sacco-platform/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   └── lib/      # Utilities & hooks
│   │   └── package.json
│   └── api/              # NestJS backend
│       ├── src/
│       │   ├── auth/     # Authentication
│       │   ├── members/  # Members module
│       │   ├── loans/    # Loans module
│       │   └── main.ts   # Entry point
│       └── package.json
├── db/                   # Database management
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── seeds/
├── packages/
│   └── config/           # Shared configs
│       ├── eslint-preset.js
│       ├── prettier.config.js
│       └── tsconfig.base.json
└── docs/                 # Documentation
    ├── architecture.md   # This file
    ├── 01-project-overview.md
    └── ...
```

## Performance Considerations

### Frontend Optimization
- Server-side rendering for faster initial loads
- Code splitting and lazy loading
- Image optimization
- Caching strategies

### Backend Optimization
- Database connection pooling
- Query optimization
- Response caching
- Efficient pagination

### Database Optimization
- Proper indexing
- Query performance monitoring
- Connection management
- Backup strategies

## Scalability

### Horizontal Scaling
- Stateless API design
- Load balancing ready
- Database read replicas
- CDN for static assets

### Vertical Scaling
- Efficient resource utilization
- Query optimization
- Caching layers
- Database performance tuning

## Future Enhancements

1. **Real-time Features**
   - WebSocket support for live updates
   - Push notifications
   - Real-time transaction monitoring

2. **Analytics Dashboard**
   - Business intelligence
   - Performance metrics
   - Financial reports

3. **Mobile App**
   - React Native application
   - Offline capabilities
   - Biometric authentication

4. **Additional Payment Gateways**
   - Bank integration
   - Card payments
   - Alternative payment methods

## Contributing

This architecture is designed to be maintainable and extensible. When contributing:

1. Follow the established patterns in each layer
2. Maintain type safety with TypeScript
3. Write tests for new features
4. Update documentation for architectural changes
5. Follow security best practices
6. Use conventional commits

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [M-Pesa API Documentation](https://developer.safaricom.co.ke)

---

**Last Updated:** November 13, 2025  
**Version:** 1.0.0  
**Maintained By:** Church SACCO Platform Team
