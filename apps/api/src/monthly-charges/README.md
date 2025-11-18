# Monthly Charges Feature

## Overview
Automated system for charging KES 100 monthly maintenance fee to all active SACCO members.

## Features
- ✅ Automated monthly charging on 1st of each month at 02:00 EAT
- ✅ BullMQ job queue for reliable processing
- ✅ Admin endpoint for manual charge execution
- ✅ Audit logging for compliance
- ✅ Balance tracking and updates
- ✅ Comprehensive error handling and reporting

## Architecture

### Components
1. **MonthlyChargesService** - Business logic for charge processing
2. **MonthlyChargesProcessor** - BullMQ job processor
3. **MonthlyChargesScheduler** - Cron-based scheduler
4. **MonthlyChargesController** - Admin API endpoints

### Database Schema
Uses existing `Transaction` table with new enum values:
- `TransactionType.MONTHLY_CHARGE` - Transaction type for monthly charges
- `TransactionChannel.SYSTEM` - Channel indicating automated system transaction

## Configuration

### Environment Variables
Add to `.env`:
```bash
# Redis Configuration (required for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional
```

### Prerequisites
- Redis server running (for BullMQ)
- PostgreSQL database with migrations applied
- Active members in the system

## API Endpoints

### 1. Run Monthly Charges (Manual)
**POST** `/admin/monthly-charges/run`

Manually trigger monthly charge processing.

**Auth**: Required (Admin/Manager/Treasurer roles)

**Query Parameters**:
- `from` (optional): Start date (YYYY-MM-DD). Defaults to first day of current month
- `to` (optional): End date (YYYY-MM-DD). Defaults to last day of current month

**Response**:
```json
{
  "message": "Monthly charges job scheduled successfully",
  "jobId": "1234567890",
  "status": "scheduled",
  "data": {
    "from": "2024-01-01",
    "to": "2024-01-31",
    "triggeredBy": "admin@example.com",
    "manual": true
  }
}
```

### 2. Check Job Status
**GET** `/admin/monthly-charges/status/:jobId`

Check the status of a monthly charges job.

**Auth**: Required (Admin/Manager/Treasurer roles)

**Response**:
```json
{
  "id": "1234567890",
  "status": "completed",
  "progress": 100,
  "result": {
    "totalMembers": 50,
    "successCount": 50,
    "failureCount": 0,
    "totalAmount": 5000,
    "errors": []
  },
  "createdAt": "2024-01-01T02:00:00Z",
  "processedAt": "2024-01-01T02:01:00Z",
  "finishedAt": "2024-01-01T02:02:00Z"
}
```

## Scheduled Execution

### Automatic Schedule
- **Frequency**: Monthly
- **Day**: 1st of each month
- **Time**: 02:00 (2:00 AM)
- **Timezone**: Africa/Nairobi (EAT)

### How It Works
1. Scheduler triggers at 02:00 on the 1st of each month
2. Job is queued in BullMQ with retry logic
3. Processor:
   - Fetches all active members
   - Checks for existing charges in the period
   - Creates charge transaction (KES 100)
   - Updates member balance
   - Logs audit entry
4. Results are stored and accessible via API

## Business Logic

### Charge Application
- **Amount**: KES 100 (fixed)
- **Target**: All members with `membershipStatus = 'ACTIVE'`
- **Idempotency**: Prevents duplicate charges for same period
- **Balance**: Deducted from member's savings account

### Transaction Details
Each charge creates a transaction with:
- Type: `MONTHLY_CHARGE`
- Channel: `SYSTEM`
- Amount: 100
- Narration: "Monthly charge for {Month Year}"
- Status: `POSTED`
- Receipt Number: Auto-generated (RCP-YYYY-NNNNNN)

### Error Handling
- Individual member failures don't stop batch processing
- Failed charges are logged with error details
- Retry logic: 3 attempts with exponential backoff
- Admin can view all errors in job result

## Testing

### Unit Tests
```bash
npm test -- monthly-charges.service.spec.ts
```

Tests cover:
- Date range calculation
- Job scheduling
- Charge processing logic
- Error handling
- Receipt number generation

### Integration Tests
```bash
npm test -- monthly-charges.integration.spec.ts
```

Tests cover:
- API endpoints
- Authentication/authorization
- Date parameter handling
- Job status retrieval

## Monitoring

### Job Queue Dashboard
BullMQ provides monitoring capabilities. Consider:
- Bull Board (UI for job monitoring)
- Redis monitoring for queue health
- Application logs for scheduler execution

### Audit Trail
All charge operations are logged:
- Timestamp
- Triggered by (user/scheduler)
- Total members processed
- Success/failure counts
- Individual errors
- Total amount charged

## Maintenance

### Manual Execution Scenarios
1. **Missed Automated Run**: Use manual endpoint to process charges
2. **Historical Charges**: Specify `from`/`to` dates for past periods
3. **Testing**: Test with specific date ranges before month-end

### Troubleshooting

**Problem**: Scheduler not executing
- Check Redis connection
- Verify scheduler is enabled in module
- Check application logs for errors

**Problem**: Charges failing for some members
- Check job status endpoint for error details
- Verify member account status
- Check database constraints

**Problem**: Duplicate charges
- System prevents this automatically
- Verify by checking transaction history
- If duplicates exist, investigate timestamp overlap

## Future Enhancements
- [ ] Configurable charge amount per member tier
- [ ] Email notifications to members
- [ ] SMS notifications
- [ ] Dedicated audit log table
- [ ] Dashboard for charge history analytics
- [ ] Grace period configuration
- [ ] Exemption management for special cases

## Security Considerations
- ✅ Role-based access control (Admin/Manager/Treasurer only)
- ✅ JWT authentication required
- ✅ Audit logging for compliance
- ✅ Idempotency to prevent duplicate charges
- ✅ Transaction integrity with database constraints

## Performance
- Batch processing of members
- Async job queue prevents blocking
- Redis-backed queue for reliability
- Automatic retry on failures
- Configurable concurrency for large member bases

## Support
For issues or questions:
1. Check application logs
2. Review job status endpoint
3. Verify Redis/Postgres connectivity
4. Contact system administrator
