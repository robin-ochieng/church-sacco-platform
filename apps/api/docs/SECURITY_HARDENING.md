# Security Hardening

This document describes the security hardening measures implemented in the API.

## Overview

The API includes three layers of security hardening:

1. **Helmet** - HTTP security headers
2. **CORS** - Strict cross-origin resource sharing
3. **Rate Limiting** - Protection against abuse and DoS attacks

## Helmet Middleware

Helmet helps secure Express apps by setting various HTTP headers.

### Configuration

Located in `src/main.ts`:

```typescript
import helmet from 'helmet';

app.use(helmet());
```

### Headers Set

- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options` - Prevents clickjacking
- `X-DNS-Prefetch-Control` - Controls DNS prefetching
- Removes `X-Powered-By` header - Hides server information

## CORS Configuration

Strict CORS policy restricts which origins can access the API.

### Configuration

Located in `src/main.ts`:

```typescript
const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
app.enableCors({
  origin: webOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### Environment Variables

```env
WEB_ORIGIN=http://localhost:3000
```

**Production:**
```env
WEB_ORIGIN=https://your-production-domain.com
```

### Features

- ✅ Single origin restriction (no wildcards)
- ✅ Credential support enabled
- ✅ Explicit method whitelist
- ✅ Explicit header whitelist
- ✅ Automatic preflight handling

## Rate Limiting

Rate limiting prevents abuse by limiting the number of requests from a single IP address.

### Configuration

Located in `src/app.module.ts`:

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl: parseInt(config.get('THROTTLE_TTL') || '60', 10) * 1000,
        limit: parseInt(config.get('THROTTLE_LIMIT') || '10', 10),
      }],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
```

### Environment Variables

```env
# Rate limiting: 10 requests per 60 seconds
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

### Default Settings

- **TTL (Time To Live):** 60 seconds
- **Limit:** 10 requests per TTL window

### Response Headers

When rate limit is active:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in current window
- `Retry-After` - Seconds until rate limit resets (on 429 responses)

### Error Response

When rate limit is exceeded, the API returns:

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

### Per-Route Override

To customize rate limits for specific routes:

```typescript
import { Throttle } from '@nestjs/throttler';

@Controller('expensive-operation')
export class ExpensiveController {
  // Lower limit for expensive operations
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post()
  async expensiveOperation() {
    // ...
  }
}
```

### Skip Rate Limiting

To skip rate limiting for specific routes:

```typescript
import { SkipThrottle } from '@nestjs/throttler';

@Controller('public')
export class PublicController {
  @SkipThrottle()
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }
}
```

## Testing

### E2E Tests

Located in `test/security.e2e-spec.ts`:

```bash
pnpm test security.e2e-spec
```

Tests include:
- ✅ CORS preflight (OPTIONS) handling
- ✅ Unauthorized origin rejection
- ✅ Authorized origin acceptance
- ✅ Helmet security headers presence
- ✅ Server information hiding
- ✅ Rate limit enforcement
- ✅ 429 response validation

### Unit Tests

Located in `test/throttler.guard.spec.ts`:

```bash
pnpm test throttler.guard.spec
```

Tests include:
- ✅ Requests under rate limit pass
- ✅ Requests exceeding rate limit return 429
- ✅ Rate limit resets after TTL
- ✅ Proper error messages in 429 responses

## Production Recommendations

### 1. Adjust Rate Limits

Tune rate limits based on your traffic patterns:

```env
# For high-traffic APIs
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# For low-traffic/sensitive endpoints
THROTTLE_TTL=60
THROTTLE_LIMIT=5
```

### 2. Monitor Rate Limit Hits

Log 429 responses to identify:
- Potential DoS attacks
- Misconfigured clients
- Need for rate limit adjustments

### 3. Use Different Limits for Different Endpoints

```typescript
// Auth endpoints - strict limits
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post('login')

// Read endpoints - generous limits
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Get('members')

// Write endpoints - moderate limits
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Post('members')
```

### 4. Consider IP Whitelisting

For known integrations, consider skipping rate limits:

```typescript
@SkipThrottle()
@Post('webhook')
async handleWebhook(@Headers('x-api-key') apiKey: string) {
  // Validate API key
  // Process webhook
}
```

### 5. CORS Configuration

**Development:**
```env
WEB_ORIGIN=http://localhost:3000
```

**Production:**
```env
WEB_ORIGIN=https://sacco.yourdomain.com
```

**Multiple Origins (if needed):**
```typescript
app.enableCors({
  origin: [
    'https://sacco.yourdomain.com',
    'https://admin.yourdomain.com'
  ],
  credentials: true,
});
```

## Security Checklist

- [x] Helmet middleware enabled
- [x] CORS strictly configured with WEB_ORIGIN
- [x] Rate limiting enabled globally
- [x] Rate limit headers exposed
- [x] 429 error responses tested
- [x] CORS preflight tested
- [x] Security headers tested
- [ ] Production environment variables set
- [ ] Rate limits tuned for production traffic
- [ ] Monitoring/alerting for 429 responses
- [ ] IP whitelisting configured (if needed)

## Troubleshooting

### "Too Many Requests" in Development

If you hit rate limits during development:

1. Increase limits in `.env`:
   ```env
   THROTTLE_LIMIT=100
   ```

2. Or disable for specific routes:
   ```typescript
   @SkipThrottle()
   ```

### CORS Errors

If you see CORS errors:

1. Check `WEB_ORIGIN` matches your frontend URL
2. Verify frontend is sending requests to correct API URL
3. Check browser console for specific CORS error
4. Ensure credentials are included if needed:
   ```typescript
   fetch(url, { credentials: 'include' })
   ```

### Rate Limit Not Working

1. Verify `APP_GUARD` is registered in `app.module.ts`
2. Check environment variables are loaded
3. Verify `ThrottlerModule` is imported
4. Check for `@SkipThrottle()` decorators

## References

- [Helmet Documentation](https://helmetjs.github.io/)
- [NestJS Throttler](https://docs.nestjs.com/security/rate-limiting)
- [CORS Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
