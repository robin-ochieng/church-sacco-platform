# KYC Storage Bucket Setup

This document explains how to set up the KYC storage bucket in Supabase for document uploads.

## Bucket Configuration

The application uses a Supabase storage bucket named `kyc` to store KYC (Know Your Customer) documents uploaded by members during registration.

### Create the Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New Bucket"**
4. Configure the bucket:
   - **Name**: `kyc`
   - **Public**: `No` (files should be private)
   - **File size limit**: 10 MB
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/jpg`
     - `image/png`
     - `image/webp`
     - `application/pdf`

### Storage Policies

Apply the following Row Level Security (RLS) policies to the `kyc` bucket:

#### 1. Upload Policy (Authenticated users can upload their own files)

```sql
CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 2. Select Policy (Users can view their own files)

```sql
CREATE POLICY "Users can view their own KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 3. Update Policy (Users can update their own files)

```sql
CREATE POLICY "Users can update their own KYC documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 4. Delete Policy (Users can delete their own files)

```sql
CREATE POLICY "Users can delete their own KYC documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## File Organization

Files are organized by user ID:
```
kyc/
├── {userId}/
│   ├── {timestamp}_id_front.jpg
│   ├── {timestamp}_id_back.jpg
│   └── {timestamp}_proof_of_address.pdf
```

## File Naming Convention

The storage service automatically generates file names using the format:
```
{userId}/{timestamp}_{sanitizedFileName}
```

Example: `abc123-def456/1699900800000_national_id.jpg`

## Security Features

1. **Authentication Required**: All storage operations require JWT authentication
2. **User Isolation**: Users can only access their own files (enforced by RLS policies)
3. **File Type Validation**: Only whitelisted MIME types are allowed
4. **File Size Limits**: Maximum 10MB per file
5. **Signed URLs**: All uploads and downloads use time-limited signed URLs
6. **Path Sanitization**: File names are sanitized to prevent path traversal attacks

## API Endpoints

### Generate Upload URL
```http
POST /api/v1/storage/kyc/upload-url
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "fileName": "national_id.jpg",
  "contentType": "image/jpeg",
  "maxFileSizeBytes": 5242880
}
```

**Response:**
```json
{
  "signedUrl": "https://your-project.supabase.co/storage/v1/object/upload/sign/kyc/...",
  "token": "upload-token-xyz",
  "path": "user-id/1699900800000_national_id.jpg",
  "expiresIn": 3600
}
```

### List User Files
```http
GET /api/v1/storage/kyc/files
Authorization: Bearer {jwt-token}
```

### Generate Download URL
```http
GET /api/v1/storage/kyc/download-url/{filePath}
Authorization: Bearer {jwt-token}
```

### Delete File
```http
DELETE /api/v1/storage/kyc/{filePath}
Authorization: Bearer {jwt-token}
```

## Usage in Application

### Backend (NestJS)

```typescript
import { StorageService } from './supabase/storage.service';

@Injectable()
export class MemberService {
  constructor(private storageService: StorageService) {}

  async getUploadUrl(userId: string, fileName: string) {
    return this.storageService.generateSignedUploadUrl({
      userId,
      fileName,
      contentType: 'image/jpeg',
    });
  }
}
```

### Frontend (Next.js)

```typescript
// Request signed URL from API
const response = await fetch('/api/v1/storage/kyc/upload-url', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fileName: file.name,
    contentType: file.type,
  }),
});

const { signedUrl, token } = await response.json();

// Upload file directly to Supabase Storage
await fetch(signedUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type,
    'Authorization': `Bearer ${token}`,
  },
  body: file,
});
```

## Testing

Run the storage service tests:
```bash
cd apps/api
pnpm test storage.service.spec.ts
```

## Monitoring

Monitor storage usage in the Supabase Dashboard:
- **Storage** > **kyc** bucket
- View total storage used
- See file count per user
- Check recent uploads

## Troubleshooting

### Issue: "Bucket not found"
- Ensure the `kyc` bucket is created in Supabase Dashboard
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env`

### Issue: "Permission denied"
- Check RLS policies are applied
- Verify JWT token is valid
- Ensure user is authenticated

### Issue: "File type not allowed"
- Check the file MIME type is in the allowed list
- Update `ALLOWED_MIME_TYPES` in `storage.service.ts` if needed

## Next Steps

1. ✅ Bucket created and configured
2. ✅ RLS policies applied
3. ⏳ Create frontend file upload component
4. ⏳ Integrate with member registration form
5. ⏳ Add file preview functionality
