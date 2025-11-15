import { Test, TestingModule } from '@nestjs/testing';
import { MemberNumberGenerator } from '../member-number.generator';
import { PrismaService } from '../../prisma/prisma.service';

describe('MemberNumberGenerator', () => {
  let generator: MemberNumberGenerator;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberNumberGenerator,
        {
          provide: PrismaService,
          useValue: {
            member: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    generator = module.get<MemberNumberGenerator>(MemberNumberGenerator);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('generateMemberNumber', () => {
    it('should generate first member number for current year', async () => {
      const currentYear = new Date().getFullYear();
      const expected = `ATSC-${currentYear}-0001`;

      jest.spyOn(prismaService.member, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.member, 'findUnique').mockResolvedValue(null);

      const result = await generator.generateMemberNumber();

      expect(result).toBe(expected);
      expect(prismaService.member.findFirst).toHaveBeenCalledWith({
        where: {
          memberNumber: {
            startsWith: `ATSC-${currentYear}-`,
          },
        },
        orderBy: {
          memberNumber: 'desc',
        },
        select: {
          memberNumber: true,
        },
      });
    });

    it('should increment from last member number', async () => {
      const currentYear = new Date().getFullYear();
      const lastMemberNumber = `ATSC-${currentYear}-0042`;
      const expected = `ATSC-${currentYear}-0043`;

      jest.spyOn(prismaService.member, 'findFirst').mockResolvedValue({
        memberNumber: lastMemberNumber,
      } as any);
      jest.spyOn(prismaService.member, 'findUnique').mockResolvedValue(null);

      const result = await generator.generateMemberNumber();

      expect(result).toBe(expected);
    });

    it('should handle year rollover correctly', async () => {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      const lastYearMember = `ATSC-${lastYear}-9999`;
      const expected = `ATSC-${currentYear}-0001`;

      jest.spyOn(prismaService.member, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.member, 'findUnique').mockResolvedValue(null);

      const result = await generator.generateMemberNumber();

      expect(result).toBe(expected);
    });

    it('should retry if race condition detected', async () => {
      const currentYear = new Date().getFullYear();
      const expected = `ATSC-${currentYear}-0002`;

      jest
        .spyOn(prismaService.member, 'findFirst')
        .mockResolvedValueOnce({
          memberNumber: `ATSC-${currentYear}-0001`,
        } as any)
        .mockResolvedValueOnce({
          memberNumber: `ATSC-${currentYear}-0001`,
        } as any);

      jest
        .spyOn(prismaService.member, 'findUnique')
        .mockResolvedValueOnce({} as any) // First try exists
        .mockResolvedValueOnce(null); // Second try available

      const result = await generator.generateMemberNumber();

      expect(result).toBe(expected);
      expect(prismaService.member.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should format sequence with leading zeros', async () => {
      const currentYear = new Date().getFullYear();
      const testCases = [
        { last: '0001', expected: '0002' },
        { last: '0009', expected: '0010' },
        { last: '0099', expected: '0100' },
        { last: '0999', expected: '1000' },
      ];

      for (const testCase of testCases) {
        jest.spyOn(prismaService.member, 'findFirst').mockResolvedValue({
          memberNumber: `ATSC-${currentYear}-${testCase.last}`,
        } as any);
        jest.spyOn(prismaService.member, 'findUnique').mockResolvedValue(null);

        const result = await generator.generateMemberNumber();
        expect(result).toBe(`ATSC-${currentYear}-${testCase.expected}`);
      }
    });
  });

  describe('validateFormat', () => {
    it('should validate correct format', () => {
      const validNumbers = [
        'ATSC-2025-0001',
        'ATSC-2024-9999',
        'ATSC-2030-1234',
      ];

      validNumbers.forEach((num) => {
        expect(MemberNumberGenerator.validateFormat(num)).toBe(true);
      });
    });

    it('should reject invalid formats', () => {
      const invalidNumbers = [
        'ATSC-25-0001', // Year too short
        'ATSC-2025-001', // Sequence too short
        'ATSC-2025-00001', // Sequence too long
        'atsc-2025-0001', // Wrong case
        'ATSC_2025_0001', // Wrong separator
        '2025-0001', // Missing prefix
        'ATSC-2025', // Missing sequence
        '',
        'invalid',
      ];

      invalidNumbers.forEach((num) => {
        expect(MemberNumberGenerator.validateFormat(num)).toBe(false);
      });
    });
  });

  describe('extractYear', () => {
    it('should extract year from valid member number', () => {
      expect(MemberNumberGenerator.extractYear('ATSC-2025-0001')).toBe(2025);
      expect(MemberNumberGenerator.extractYear('ATSC-2024-9999')).toBe(2024);
      expect(MemberNumberGenerator.extractYear('ATSC-2030-1234')).toBe(2030);
    });

    it('should return null for invalid format', () => {
      expect(MemberNumberGenerator.extractYear('invalid')).toBeNull();
      expect(MemberNumberGenerator.extractYear('')).toBeNull();
      expect(MemberNumberGenerator.extractYear('ATSC-25-0001')).toBeNull();
    });
  });

  describe('extractSequence', () => {
    it('should extract sequence number from valid member number', () => {
      expect(MemberNumberGenerator.extractSequence('ATSC-2025-0001')).toBe(1);
      expect(MemberNumberGenerator.extractSequence('ATSC-2025-0042')).toBe(42);
      expect(MemberNumberGenerator.extractSequence('ATSC-2025-9999')).toBe(9999);
    });

    it('should return null for invalid format', () => {
      expect(MemberNumberGenerator.extractSequence('invalid')).toBeNull();
      expect(MemberNumberGenerator.extractSequence('')).toBeNull();
      expect(MemberNumberGenerator.extractSequence('ATSC-2025-001')).toBeNull();
    });
  });
});
