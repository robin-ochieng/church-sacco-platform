/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '../src/supabase/storage.service';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('StorageService', () => {
  let service: StorageService;
  let supabaseService: SupabaseService;

  const mockStorageClient = {
    from: jest.fn().mockReturnThis(),
    createSignedUploadUrl: jest.fn(),
    createSignedUrl: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
  };

  const mockSupabaseClient = {
    storage: mockStorageClient,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    supabaseService = module.get<SupabaseService>(SupabaseService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSignedUploadUrl', () => {
    it('should generate a signed upload URL successfully', async () => {
      const mockResponse = {
        signedUrl: 'https://supabase.co/signed-url',
        token: 'mock-token-123',
        path: 'test-user/123456_test.pdf',
      };

      mockStorageClient.createSignedUploadUrl.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.generateSignedUploadUrl({
        userId: 'test-user',
        fileName: 'test.pdf',
        contentType: 'application/pdf',
      });

      expect(result).toEqual({
        signedUrl: mockResponse.signedUrl,
        token: mockResponse.token,
        path: expect.stringContaining('test-user/'),
        expiresIn: 3600,
      });

      expect(mockStorageClient.from).toHaveBeenCalledWith('kyc');
      expect(mockStorageClient.createSignedUploadUrl).toHaveBeenCalledWith(
        expect.stringContaining('test-user/')
      );
    });

    it('should sanitize file names', async () => {
      mockStorageClient.createSignedUploadUrl.mockResolvedValue({
        data: {
          signedUrl: 'https://supabase.co/signed-url',
          token: 'mock-token',
          path: 'test-user/test.pdf',
        },
        error: null,
      });

      await service.generateSignedUploadUrl({
        userId: 'test-user',
        fileName: '../../../etc/passwd',
      });

      expect(mockStorageClient.createSignedUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/test-user\/\d+_\._\._\._etc_passwd/)
      );
    });

    it('should reject invalid content types', async () => {
      await expect(
        service.generateSignedUploadUrl({
          userId: 'test-user',
          fileName: 'test.exe',
          contentType: 'application/x-msdownload',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files exceeding max size', async () => {
      await expect(
        service.generateSignedUploadUrl({
          userId: 'test-user',
          fileName: 'large-file.pdf',
          maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle Supabase errors gracefully', async () => {
      mockStorageClient.createSignedUploadUrl.mockResolvedValue({
        data: null,
        error: { message: 'Bucket not found' },
      });

      await expect(
        service.generateSignedUploadUrl({
          userId: 'test-user',
          fileName: 'test.pdf',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept all allowed MIME types', async () => {
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'application/pdf',
      ];

      mockStorageClient.createSignedUploadUrl.mockResolvedValue({
        data: {
          signedUrl: 'https://supabase.co/signed-url',
          token: 'mock-token',
          path: 'test.pdf',
        },
        error: null,
      });

      for (const contentType of allowedTypes) {
        await expect(
          service.generateSignedUploadUrl({
            userId: 'test-user',
            fileName: 'test-file',
            contentType,
          })
        ).resolves.toBeDefined();
      }
    });
  });

  describe('generateSignedDownloadUrl', () => {
    it('should generate a signed download URL successfully', async () => {
      const mockSignedUrl = 'https://supabase.co/download-url';

      mockStorageClient.createSignedUrl.mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null,
      });

      const result = await service.generateSignedDownloadUrl(
        'test-user/123_test.pdf'
      );

      expect(result).toBe(mockSignedUrl);
      expect(mockStorageClient.from).toHaveBeenCalledWith('kyc');
      expect(mockStorageClient.createSignedUrl).toHaveBeenCalledWith(
        'test-user/123_test.pdf',
        3600
      );
    });

    it('should handle custom expiry times', async () => {
      mockStorageClient.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://supabase.co/download-url' },
        error: null,
      });

      await service.generateSignedDownloadUrl('test.pdf', 7200);

      expect(mockStorageClient.createSignedUrl).toHaveBeenCalledWith(
        'test.pdf',
        7200
      );
    });
  });

  describe('listUserFiles', () => {
    it('should list files for a user', async () => {
      const mockFiles = [
        { name: 'file1.pdf', id: '1' },
        { name: 'file2.jpg', id: '2' },
      ];

      mockStorageClient.list.mockResolvedValue({
        data: mockFiles,
        error: null,
      });

      const result = await service.listUserFiles('test-user');

      expect(result).toEqual(mockFiles);
      expect(mockStorageClient.from).toHaveBeenCalledWith('kyc');
      expect(mockStorageClient.list).toHaveBeenCalledWith('test-user');
    });

    it('should return empty array when no files found', async () => {
      mockStorageClient.list.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.listUserFiles('test-user');

      expect(result).toEqual([]);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      mockStorageClient.remove.mockResolvedValue({
        data: {},
        error: null,
      });

      await service.deleteFile('test-user/123_test.pdf');

      expect(mockStorageClient.from).toHaveBeenCalledWith('kyc');
      expect(mockStorageClient.remove).toHaveBeenCalledWith([
        'test-user/123_test.pdf',
      ]);
    });

    it('should throw error when deletion fails', async () => {
      mockStorageClient.remove.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      });

      await expect(service.deleteFile('test.pdf')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockStorageClient.list.mockResolvedValue({
        data: [{ name: 'test.pdf' }],
        error: null,
      });

      const exists = await service.fileExists('test-user/test.pdf');

      expect(exists).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockStorageClient.list.mockResolvedValue({
        data: [],
        error: null,
      });

      const exists = await service.fileExists('test-user/nonexistent.pdf');

      expect(exists).toBe(false);
    });

    it('should return false on error', async () => {
      mockStorageClient.list.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const exists = await service.fileExists('test.pdf');

      expect(exists).toBe(false);
    });
  });
});
