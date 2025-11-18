# P1.5 Monthly Charge Automation - Quick Reference

## ✅ Implementation Status: COMPLETE

---

## 🚀 Quick Start

### 1. Prerequisites Check
```powershell
# Check if Redis is running
docker ps | findstr redis
# Or
redis-cli ping  # Should return "PONG"

# Check if API packages are installed
cd apps/api
npm list @nestjs/bull bull  # Should show installed versions
```

### 2. Start Redis (if not running)
```powershell
docker run -d --name sacco-redis -p 6379:6379 redis:7-alpine
```

### 3. Configure Environment
Add to `apps/api/.env`:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 4. Run Migration
```powershell
cd db
npx prisma migrate dev --name add_monthly_charge_type
npx prisma generate
```

### 5. Start API
```powershell
cd apps/api
npm run dev
```

---

## 📋 API Endpoints

### Run Monthly Charges (Manual)
```http
POST /admin/monthly-charges/run
Authorization: Bearer <JWT_TOKEN>
Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (optional)

Response (202):
{
  "message": "Monthly charges job scheduled successfully",
  "jobId": "123",
  "status": "scheduled"
}
```

### Check Job Status
```http
GET /admin/monthly-charges/status/:jobId
Authorization: Bearer <JWT_TOKEN>

Response (200):
{
  "id": "123",
  "status": "completed",
  "progress": 100,
  "result": {
    "totalMembers": 50,
    "successCount": 50,
    "failureCount": 0,
    "totalAmount": 5000,
    "errors": []
  }
}
```

---

## 🧪 Testing Commands

```powershell
# Type check
npm run typecheck

# Unit tests
npm test -- monthly-charges.service.spec.ts

# Integration tests
npm test -- monthly-charges.integration.spec.ts

# All monthly charges tests
npm test -- monthly-charges

# With coverage
npm test -- monthly-charges --coverage
```

---

## 🔍 Monitoring Commands

### Check Redis Queue
```powershell
redis-cli
> KEYS bull:monthly-charges:*
> LLEN bull:monthly-charges:waiting
> LLEN bull:monthly-charges:active
> LLEN bull:monthly-charges:completed
> LLEN bull:monthly-charges:failed
```

### Check Database
```sql
-- Recent monthly charges
SELECT t.*, m.memberNumber, m.firstName, m.lastName
FROM "Transaction" t
JOIN "Member" m ON t.memberId = m.id
WHERE t.type = 'MONTHLY_CHARGE'
ORDER BY t.createdAt DESC
LIMIT 10;

-- Active members count
SELECT COUNT(*) FROM "Member" 
WHERE membershipStatus = 'ACTIVE';

-- Total charges for current month
SELECT 
  COUNT(*) as charge_count,
  SUM(amount) as total_amount
FROM "Transaction"
WHERE type = 'MONTHLY_CHARGE'
  AND DATE_TRUNC('month', "valueDate") = DATE_TRUNC('month', CURRENT_DATE);
```

---

## 📅 Scheduled Execution

- **When**: 1st of every month at 02:00 EAT
- **Cron**: `0 2 1 * *`
- **Timezone**: Africa/Nairobi
- **Automatic**: Yes (as long as API is running)

---

## 🎯 Key Features

| Feature | Status | Details |
|---------|--------|---------|
| Automated Scheduling | ✅ | Runs monthly at 02:00 on 1st |
| Manual Execution | ✅ | Admin API endpoint available |
| Idempotency | ✅ | Prevents duplicate charges |
| Audit Trail | ✅ | All operations logged |
| Error Handling | ✅ | Graceful failures with retry |
| Balance Tracking | ✅ | Automatic deduction |
| Receipt Generation | ✅ | Unique receipt numbers |
| Role-Based Access | ✅ | Admin/Manager/Treasurer only |

---

## 💡 Common Tasks

### Test Manual Charge Execution
```powershell
# 1. Get auth token
$response = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:4000/api/v1/auth/signin" `
  -Body (@{email="admin@example.com"; password="password"} | ConvertTo-Json) `
  -ContentType "application/json"
$token = $response.access_token

# 2. Trigger charges
$result = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:4000/api/v1/admin/monthly-charges/run" `
  -Headers @{"Authorization"="Bearer $token"}

# 3. Check status
Invoke-RestMethod -Method GET `
  -Uri "http://localhost:4000/api/v1/admin/monthly-charges/status/$($result.jobId)" `
  -Headers @{"Authorization"="Bearer $token"} | ConvertTo-Json
```

### Force Scheduler to Run Now (for testing)
1. Edit `monthly-charges.scheduler.ts`
2. Change cron to: `@Cron('* * * * *')  // Every minute`
3. Restart API
4. Watch logs for execution
5. **Remember to revert cron back to: `@Cron('0 2 1 * *')`**

### Check Logs
```powershell
# Watch logs in real-time
cd apps/api
npm run dev | findstr MonthlyCharges

# Or check specific log file if configured
Get-Content logs/app.log -Tail 50 -Wait | findstr MonthlyCharges
```

---

## ⚠️ Troubleshooting

### Problem: Redis connection error
```powershell
# Check Redis is running
docker ps | findstr redis
# Start Redis if not running
docker start sacco-redis
# Or create new Redis container
docker run -d --name sacco-redis -p 6379:6379 redis:7-alpine
```

### Problem: Module compilation errors
```powershell
# Reinstall dependencies
cd apps/api
rm -rf node_modules
pnpm install
# Or
npm install
```

### Problem: Scheduler not executing
1. Check `@nestjs/schedule` is installed: `npm list @nestjs/schedule`
2. Verify `ScheduleModule.forRoot()` in module
3. Check application logs for errors
4. Verify system time is correct

### Problem: Charges failing
1. Check job status endpoint for error details
2. Verify member data is valid
3. Check database constraints
4. Review error logs

---

## 📚 Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Setup Guide | `MONTHLY_CHARGES_SETUP.md` | Complete setup instructions |
| Implementation Summary | `P1.5_IMPLEMENTATION_COMPLETE.md` | Technical details |
| Feature README | `apps/api/src/monthly-charges/README.md` | Feature documentation |
| This Quick Reference | `MONTHLY_CHARGES_QUICKREF.md` | Quick commands & tips |

---

## 🏗️ Architecture Summary

```
MonthlyChargesModule
├── MonthlyChargesScheduler (Cron: 0 2 1 * *)
│   └── Triggers monthly on 1st @ 02:00
├── MonthlyChargesService (Business Logic)
│   ├── scheduleMonthlyCharges()
│   ├── processMonthlyCharges()
│   ├── applyMonthlyCharge()
│   └── getJobStatus()
├── MonthlyChargesProcessor (BullMQ)
│   └── Processes jobs from queue
└── MonthlyChargesController (REST API)
    ├── POST /admin/monthly-charges/run
    └── GET /admin/monthly-charges/status/:jobId
```

**Queue**: `monthly-charges`  
**Database**: Reuses `Transaction` table  
**Charge Amount**: KES 100 (fixed)  
**Target**: Members with `membershipStatus = 'ACTIVE'`

---

## 📊 Success Criteria

- ✅ Compiles without TypeScript errors
- ✅ Unit tests pass (8 test cases)
- ✅ Integration tests pass (4 test cases)
- ✅ Manual API execution works
- ⏳ Scheduled execution tested (wait for 1st of month)
- ⏳ Production deployment complete
- ⏳ Monitoring configured

---

## 🎓 Key Learning Points

1. **BullMQ** requires Redis - ensure it's running
2. **Idempotency** is built-in - safe to retry
3. **Async Processing** - jobs don't block the API
4. **Error Isolation** - one member's failure doesn't stop the batch
5. **Audit Logs** - every operation is tracked
6. **Role-Based** - only Admin/Manager/Treasurer can execute

---

## 📞 Support

**Issues?** Check in order:
1. This quick reference
2. `MONTHLY_CHARGES_SETUP.md` (troubleshooting section)
3. Application logs
4. Redis status: `redis-cli ping`
5. Database connectivity: `psql -U user -d database`
6. Contact development team

---

**Last Updated**: November 17, 2024  
**Version**: 1.0.0  
**Status**: ✅ Ready for Testing
