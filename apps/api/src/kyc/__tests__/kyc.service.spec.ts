/// <reference types="jest" />
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { KycDocumentType } from '../dto';
import { KycService } from '../kyc.service';

describe('KycService', () => {
  let service: KycService;
  let prismaService: PrismaService;
  let supabaseService: SupabaseService;

  const mockMember = {
    id: 'member-123',
    userId: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    memberNumber: 'ATSC-2024-0001',
  };

  const mockSupabaseClient = {
    storage: {
      from: jest.fn().mockReturnThis(),
      createSignedUploadUrl: jest.fn(),
      createSignedUrl: jest.fn(),
      list: jest.fn(),
    },
  };

  const mockPrismaService = {
    member: {
      findUnique: jest.fn(),
    },
  };

  const mockSupabaseService = {
    getClient: jest.fn(() => mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    prismaService = module.get<PrismaService>(PrismaService);
    supabaseService = module.get<SupabaseService>(SupabaseService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateUploadUrl', () => {
    const uploadDto = {
      documentType: KycDocumentType.ID_FRONT,
      fileExtension: 'jpg',
    };

    it('should generate upload URL for own member', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/upload/signed-url' },
          error: null,
        }),
      });

      const result = await service.generateUploadUrl(
        'member-123',
        uploadDto,
        'user-123', // Same user
        'member',
      );

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('expiresIn');
      expect(result.uploadUrl).toBe('https://supabase.co/upload/signed-url');
      expect(result.filePath).toContain('member-123');
      expect(result.filePath).toContain('id_front');
      expect(result.expiresIn).toBe(3600);
    });

    it('should generate upload URL for clerk accessing member', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/upload/clerk-url' },
          error: null,
        }),
      });

      const result = await service.generateUploadUrl(
        'member-123',
        uploadDto,
        'different-user', // Different user
        'clerk', // But clerk role
      );

      expect(result).toHaveProperty('uploadUrl');
      expect(result.uploadUrl).toBe('https://supabase.co/upload/clerk-url');
    });

    it('should generate upload URL for manager accessing member', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/upload/manager-url' },
          error: null,
        }),
      });

      const result = await service.generateUploadUrl(
        'member-123',
        uploadDto,
        'different-user',
        'manager',
      );

      expect(result).toHaveProperty('uploadUrl');
    });

    it('should generate upload URL for admin accessing member', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/upload/admin-url' },
          error: null,
        }),
      });

      const result = await service.generateUploadUrl(
        'member-123',
        uploadDto,
        'different-user',
        'admin',
      );

      expect(result).toHaveProperty('uploadUrl');
    });

    it('should throw ForbiddenException for unauthorized cross-member access', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);

      await expect(
        service.generateUploadUrl(
          'member-123',
          uploadDto,
          'different-user', // Different user
          'member', // Not authorized role
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.generateUploadUrl(
          'member-123',
          uploadDto,
          'different-user',
          'member',
        ),
      ).rejects.toThrow('You are not authorized to upload KYC documents for this member');
    });

    it('should throw NotFoundException for non-existent member', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(null);

      await expect(
        service.generateUploadUrl(
          'non-existent',
          uploadDto,
          'user-123',
          'member',
        ),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.generateUploadUrl(
          'non-existent',
          uploadDto,
          'user-123',
          'member',
        ),
      ).rejects.toThrow('Member with ID non-existent not found');
    });

    it('should throw error if Supabase fails to create signed URL', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage bucket not found' },
        }),
      });

      await expect(
        service.generateUploadUrl(
          'member-123',
          uploadDto,
          'user-123',
          'member',
        ),
      ).rejects.toThrow('Failed to generate upload URL: Storage bucket not found');
    });

    it('should generate unique file paths for different document types', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/upload/url' },
          error: null,
        }),
      });

      const idFrontResult = await service.generateUploadUrl(
        'member-123',
        { documentType: KycDocumentType.ID_FRONT, fileExtension: 'jpg' },
        'user-123',
        'member',
      );

      const idBackResult = await service.generateUploadUrl(
        'member-123',
        { documentType: KycDocumentType.ID_BACK, fileExtension: 'jpg' },
        'user-123',
        'member',
      );

      expect(idFrontResult.filePath).toContain('id_front');
      expect(idBackResult.filePath).toContain('id_back');
      expect(idFrontResult.filePath).not.toBe(idBackResult.filePath);
    });
  });

  describe('getDownloadUrl', () => {
    it('should generate download URL for own member', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/download/url' },
          error: null,
        }),
      });

      const result = await service.getDownloadUrl(
        'member-123',
        'member-123/id_front.jpg',
        'user-123',
        'member',
      );

      expect(result).toBe('https://supabase.co/download/url');
    });

    it('should throw ForbiddenException for unauthorized access', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);

      await expect(
        service.getDownloadUrl(
          'member-123',
          'member-123/id_front.jpg',
          'different-user',
          'member',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listMemberDocuments', () => {
    it('should list all documents for a member', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockSupabaseClient.storage.from.mockReturnValue({
        list: jest.fn().mockResolvedValue({
          data: [
            { name: 'id_front_123.jpg' },
            { name: 'id_back_123.jpg' },
            { name: 'selfie_123.jpg' },
          ],
          error: null,
        }),
      });

      const result = await service.listMemberDocuments('member-123');

      expect(result).toHaveLength(3);
      expect(result).toContain('member-123/id_front_123.jpg');
      expect(result).toContain('member-123/id_back_123.jpg');
      expect(result).toContain('member-123/selfie_123.jpg');
    });

    it('should throw NotFoundException for non-existent member', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(null);

      await expect(
        service.listMemberDocuments('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
