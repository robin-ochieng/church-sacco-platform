# P1.5 Monthly Charge Automation - Setup Guide

## Implementation Complete ✅

The monthly charge automation system has been fully implemented with the following components:

### Files Created/Modified

#### Core Implementation
1. ✅ `apps/api/src/monthly-charges/monthly-charges.module.ts` - Main module
2. ✅ `apps/api/src/monthly-charges/monthly-charges.service.ts` - Business logic
3. ✅ `apps/api/src/monthly-charges/monthly-charges.processor.ts` - BullMQ processor
4. ✅ `apps/api/src/monthly-charges/monthly-charges.scheduler.ts` - Cron scheduler
5. ✅ `apps/api/src/monthly-charges/monthly-charges.controller.ts` - Admin API
6. ✅ `apps/api/src/monthly-charges/README.md` - Feature documentation

#### Tests
7. ✅ `apps/api/src/monthly-charges/__tests__/monthly-charges.service.spec.ts` - Unit tests
8. ✅ `apps/api/src/monthly-charges/__tests__/monthly-charges.integration.spec.ts` - Integration tests

#### Configuration
9. ✅ `apps/api/src/app.module.ts` - Added BullModule and MonthlyChargesModule
10. ✅ `db/prisma/schema.prisma` - Added MONTHLY_CHARGE and SYSTEM enums

#### Dependencies
11. ✅ Installed: `@nestjs/bull`, `bull`, `@types/bull`, `@nestjs/schedule`

---

## Setup Instructions

### 1. Install and Start Redis

**Option A: Using Docker (Recommended)**
```powershell
# Pull Redis image
docker pull redis:7-alpine

# Run Redis container
docker run -d `
  --name sacco-redis `
  -p 6379:6379 `
  redis:7-alpine

# Verify Redis is running
docker ps | findstr redis
```

**Option B: Using Windows Redis**
```powershell
# Download from: https://github.com/tporadowski/redis/releases
# Install and start Redis service
# Or use Chocolatey:
choco install redis-64
redis-server
```

**Option C: Using WSL2**
```bash
# In WSL2 terminal
sudo apt update
sudo apt install redis-server
sudo service redis-server start
redis-cli ping  # Should return "PONG"
```

### 2. Update Environment Variables

Add to `apps/api/.env`:
```bash
# Redis Configuration for BullMQ
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty if no password set
```

### 3. Run Database Migration

```powershell
cd db
npx prisma migrate dev --name add_monthly_charge_type
```

If you get migration errors, you can:
```powershell
# Reset and reapply all migrations
npx prisma migrate reset --force
npx prisma generate
```

### 4. Start the API Server

```powershell
cd apps/api
npm run dev
```

You should see:
```
✅ MonthlyChargesModule initialized
✅ Bull queue 'monthly-charges' registered
✅ Scheduler 'monthly-charges' registered
```

---

## Testing the Implementation

### 1. Verify Redis Connection

```powershell
# Test Redis connectivity
redis-cli ping
# Should return: PONG
```

### 2. Seed Test Data (if needed)

Make sure you have active members in the database:
```sql
-- Check active members
SELECT id, memberNumber, firstName, lastName, membershipStatus 
FROM "Member" 
WHERE membershipStatus = 'ACTIVE';
```

### 3. Test Manual Charge Execution

**Step 1: Authenticate and get JWT token**
```powershell
$response = Invoke-RestMethod -Method POST -Uri "http://localhost:4000/api/v1/auth/signin" `
  -Body (@{
    email = "admin@example.com"
    password = "your-password"
  } | ConvertTo-Json) `
  -ContentType "application/json"

$token = $response.access_token
```

**Step 2: Trigger monthly charges**
```powershell
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Run for current month
$result = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:4000/api/v1/admin/monthly-charges/run" `
  -Headers $headers

Write-Output "Job ID: $($result.jobId)"
```

**Step 3: Check job status**
```powershell
$jobId = $result.jobId
$status = Invoke-RestMethod -Method GET `
  -Uri "http://localhost:4000/api/v1/admin/monthly-charges/status/$jobId" `
  -Headers $headers

$status | ConvertTo-Json -Depth 5
```

### 4. Verify Results in Database

```sql
-- Check transactions created
SELECT 
  t.id,
  t.receiptNumber,
  t.memberId,
  m.memberNumber,
  t.amount,
  t.type,
  t.channel,
  t.status,
  t.narration,
  t.valueDate,
  t.balanceAfter,
  t.createdAt
FROM "Transaction" t
JOIN "Member" m ON t.memberId = m.id
WHERE t.type = 'MONTHLY_CHARGE'
ORDER BY t.createdAt DESC
LIMIT 10;
```

### 5. Run Unit Tests

```powershell
cd apps/api
npm test -- monthly-charges.service.spec.ts
```

### 6. Run Integration Tests

```powershell
npm test -- monthly-charges.integration.spec.ts
```

---

## Verifying Scheduled Execution

The scheduler runs automatically on the 1st of each month at 02:00 EAT.

**To test scheduled execution (for development):**

Temporarily modify `monthly-charges.scheduler.ts`:
```typescript
// Change cron to run every minute for testing
@Cron('* * * * *', {  // Every minute
  name: 'monthly-charges',
  timeZone: 'Africa/Nairobi',
})
```

Watch logs:
```powershell
# In apps/api
npm run dev
```

You should see:
```
[MonthlyChargesScheduler] Scheduled monthly charges job triggered
[MonthlyChargesScheduler] Monthly charges job scheduled successfully
[MonthlyChargesProcessor] Processing job 123: Monthly charges for 2024-01-01 to 2024-01-31
[MonthlyChargesService] Found X active members
[MonthlyChargesService] Applied monthly charge for member M001
...
[MonthlyChargesProcessor] Job 123 completed: X successful, 0 failed
```

**Remember to revert the cron schedule back to production setting!**

---

## Monitoring in Production

### 1. Check Scheduler Status
Monitor application logs for scheduler execution:
```
grep "MonthlyChargesScheduler" logs/app.log
```

### 2. Monitor Bull Queue

Install Bull Board for visual queue monitoring:
```powershell
npm install @bull-board/api @bull-board/nestjs
```

### 3. Check Redis Queue

```powershell
redis-cli
> KEYS bull:monthly-charges:*
> LLEN bull:monthly-charges:wait
> LLEN bull:monthly-charges:active
> LLEN bull:monthly-charges:completed
> LLEN bull:monthly-charges:failed
```

---

## Troubleshooting

### Issue: "Cannot connect to Redis"
**Solution:**
```powershell
# Check if Redis is running
docker ps | findstr redis
# Or
Get-Service redis

# Restart Redis
docker restart sacco-redis
# Or
Restart-Service redis
```

### Issue: "Scheduler not executing"
**Solution:**
1. Check `@nestjs/schedule` is installed
2. Verify `ScheduleModule.forRoot()` in monthly-charges.module.ts
3. Check timezone is correct
4. Review application logs for errors

### Issue: "Duplicate charges"
**Solution:**
The system prevents duplicates automatically. If you see duplicates:
1. Check database constraints
2. Verify transaction date ranges
3. Review audit logs

### Issue: "Some charges failing"
**Solution:**
1. Check job status endpoint for error details
2. Verify member account status
3. Check database constraints (e.g., foreign keys)
4. Review member balance sufficiency

### Issue: "Migration fails"
**Solution:**
```powershell
# Reset database (WARNING: Deletes all data!)
cd db
npx prisma migrate reset --force

# Then reapply migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

---

## Next Steps

1. ✅ **Start Redis** - Install and start Redis server
2. ✅ **Update .env** - Add Redis configuration
3. ✅ **Run Migration** - Apply database schema changes
4. ✅ **Start API** - Launch the backend server
5. ✅ **Test Manually** - Trigger charges via API
6. ✅ **Verify Database** - Check transactions created
7. ✅ **Run Tests** - Execute unit and integration tests
8. ⏳ **Monitor Logs** - Watch for scheduler execution
9. ⏳ **Production Deployment** - Deploy with monitoring

---

## Production Checklist

Before going live:

- [ ] Redis is properly secured (password, firewall)
- [ ] Environment variables are set correctly
- [ ] Database backup strategy in place
- [ ] Monitoring and alerting configured
- [ ] Audit logs are being captured
- [ ] Error notifications set up
- [ ] Load testing completed
- [ ] Rollback plan documented
- [ ] Team trained on manual execution
- [ ] Support documentation shared

---

## API Reference

See `apps/api/src/monthly-charges/README.md` for complete API documentation.

**Quick Reference:**
- **Manual Run**: `POST /admin/monthly-charges/run?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **Check Status**: `GET /admin/monthly-charges/status/:jobId`
- **Auth**: JWT Bearer token with Admin/Manager/Treasurer role

---

## Support

For issues or questions:
1. Check application logs: `apps/api/logs/`
2. Review Redis queue: `redis-cli`
3. Check database state: `psql` or `pgAdmin`
4. Review this guide and feature README
5. Contact development team
