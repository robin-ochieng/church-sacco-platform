import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export enum KycDocumentType {
  ID_FRONT = 'id_front',
  ID_BACK = 'id_back',
  SELFIE = 'selfie',
  PHOTO = 'photo',
}

export interface UploadUrlRequest {
  documentType: KycDocumentType;
  fileExtension: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  filePath: string;
  expiresIn: number;
}

export interface KycUploadResult {
  filePath: string;
  documentType: KycDocumentType;
  success: boolean;
  error?: string;
}

/**
 * Request a signed upload URL from the backend
 */
export async function requestUploadUrl(
  memberId: string,
  documentType: KycDocumentType,
  fileExtension: string,
  token: string,
): Promise<UploadUrlResponse> {
  const response = await axios.post<UploadUrlResponse>(
    `${API_URL}/api/v1/members/${memberId}/kyc/upload-url`,
    {
      documentType,
      fileExtension,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  return response.data;
}

/**
 * Upload a file to Supabase using signed URL
 */
export async function uploadFileToSupabase(
  file: File,
  uploadUrl: string,
): Promise<void> {
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });
}

/**
 * Complete KYC upload flow: request URL, upload file
 */
export async function uploadKycDocument(
  memberId: string,
  file: File,
  documentType: KycDocumentType,
  token: string,
): Promise<KycUploadResult> {
  try {
    // Get file extension
    const fileExtension = file.name.split('.').pop() || 'jpg';

    // Step 1: Request signed URL
    const { uploadUrl, filePath } = await requestUploadUrl(
      memberId,
      documentType,
      fileExtension,
      token,
    );

    // Step 2: Upload file to Supabase
    await uploadFileToSupabase(file, uploadUrl);

    return {
      filePath,
      documentType,
      success: true,
    };
  } catch (error: any) {
    return {
      filePath: '',
      documentType,
      success: false,
      error: error.response?.data?.message || error.message || 'Upload failed',
    };
  }
}

/**
 * Get list of uploaded KYC documents for a member
 */
export async function listKycDocuments(
  memberId: string,
  token: string,
): Promise<string[]> {
  const response = await axios.get<string[]>(
    `${API_URL}/api/v1/members/${memberId}/kyc/documents`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return response.data;
}
