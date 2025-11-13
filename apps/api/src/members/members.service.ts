import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateMemberDto, UpdateMemberDto, MemberQueryDto } from './dto';

interface MemberRow {
  id: string;
  userId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string;
  guardianName: string | null;
  idPassportNumber: string | null;
  idLast4: string | null;
  physicalAddress: string;
  poBox: string | null;
  telephone: string | null;
  phoneLast4: string | null;
  telephoneAlt: string | null;
  phoneAltLast4: string | null;
  occupation: string | null;
  employerName: string | null;
  employerAddress: string | null;
  passportPhotoUrl: string | null;
  dateOfBirth: string;
  refereeName: string | null;
  refereePhone: string | null;
  refereeSignature: string | null;
  nextOfKinName: string;
  nextOfKinPhone: string | null;
  nextOfKinPhoneLast4: string | null;
  nextOfKinRelationship: string;
  witnessName: string | null;
  witnessSignature: string | null;
  witnessDate: string | null;
  registrationFee: number;
  joiningDate: string;
  membershipStatus: string;
  memberSignature: string | null;
  agreedToTerms: boolean;
  agreedToRefundPolicy: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
  createdAt: string;
  };
  beneficiaries: Array<{
    id: string;
    fullName: string;
    age: number | null;
    relationship: string;
  }>;
  idNumberEncrypted?: Buffer | null;
  phoneEncrypted?: Buffer | null;
  phoneAltEncrypted?: Buffer | null;
  nextOfKinPhoneEncrypted?: Buffer | null;
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async create(createMemberDto: CreateMemberDto) {
    try {
      // Check if user email already exists
      const existingUser = await this.prismaService.user.findUnique({
        where: { email: createMemberDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Check if member number already exists
      const existingMember = await this.prismaService.member.findUnique({
        where: { memberNumber: createMemberDto.memberNumber },
      });

      if (existingMember) {
        throw new ConflictException('Member number already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(createMemberDto.password, 10);

      // Create user and member in a transaction
      const result = await this.prismaService.$transaction(async (prisma) => {
        // Create user
        const user = await prisma.user.create({
          data: {
            id: crypto.randomUUID(),
            email: createMemberDto.email,
            password: hashedPassword,
            role: 'MEMBER',
            isActive: true,
          },
        });

        // Create member
        const member = await prisma.member.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            memberNumber: createMemberDto.memberNumber,
            firstName: createMemberDto.firstName,
            lastName: createMemberDto.lastName,
            middleName: createMemberDto.middleName,
            email: createMemberDto.email,
            guardianName: createMemberDto.guardianName,
            idPassportNumber: createMemberDto.idPassportNumber,
            physicalAddress: createMemberDto.physicalAddress,
            poBox: createMemberDto.poBox,
            telephone: createMemberDto.telephone,
            telephoneAlt: createMemberDto.telephoneAlt,
            dateOfBirth: new Date(createMemberDto.dateOfBirth),
            occupation: createMemberDto.occupation,
            employerName: createMemberDto.employerName,
            employerAddress: createMemberDto.employerAddress,
            passportPhotoUrl: createMemberDto.passportPhotoUrl,
            refereeName: createMemberDto.refereeName,
            refereePhone: createMemberDto.refereePhone,
            nextOfKinName: createMemberDto.nextOfKinName,
            nextOfKinPhone: createMemberDto.nextOfKinPhone,
            nextOfKinRelationship: createMemberDto.nextOfKinRelationship,
            witnessName: createMemberDto.witnessName,
            witnessDate: createMemberDto.witnessDate ? new Date(createMemberDto.witnessDate) : null,
            registrationFee: createMemberDto.registrationFee || 2000,
            joiningDate: new Date(),
            agreedToTerms: createMemberDto.agreedToTerms || false,
            agreedToRefundPolicy: createMemberDto.agreedToRefundPolicy || false,
            membershipStatus: 'ACTIVE',
          },
        });

        // Create beneficiaries if provided
        if (createMemberDto.beneficiaries && createMemberDto.beneficiaries.length > 0) {
          await prisma.beneficiary.createMany({
            data: createMemberDto.beneficiaries.map((b) => ({
              id: crypto.randomUUID(),
              memberId: member.id,
              fullName: b.fullName,
              age: b.age,
              relationship: b.relationship,
            })),
          });
        }

        return { user, member };
      });

      return {
        message: 'Member created successfully',
        member: {
          id: result.member.id,
          memberNumber: result.member.memberNumber,
          firstName: result.member.firstName,
          lastName: result.member.lastName,
          email: result.user.email,
        },
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Create member error:', error);
      throw new Error('Failed to create member');
    }
  }

  async findAll(query: MemberQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { memberNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.membershipStatus = query.status;
    }

    // Get members and total count
    const [data, total] = await Promise.all([
      this.prismaService.member.findMany({
        where,
        select: {
          id: true,
          memberNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          idLast4: true,
          phoneLast4: true,
          phoneAltLast4: true,
          nextOfKinPhoneLast4: true,
          membershipStatus: true,
          createdAt: true,
          user: {
            select: {
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.member.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const member = await this.fetchMemberWithPII('id', id);
    return { member };
  }

  async findByMemberNumber(memberNumber: string) {
    const member = await this.fetchMemberWithPII('memberNumber', memberNumber);
    return { member };
  }

  async update(id: string, updateMemberDto: UpdateMemberDto) {
    try {
      const member = await this.prismaService.member.update({
        where: { id },
        data: updateMemberDto,
      });

      return {
        message: 'Member updated successfully',
        member,
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Member not found');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      // Get member to find userId
      const member = await this.prismaService.member.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!member) {
        throw new NotFoundException('Member not found');
      }

      // Delete user (cascades to member and related records via Prisma schema)
      await this.prismaService.user.delete({
        where: { id: member.userId },
      });

      return { message: 'Member deleted successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Member not found');
      }
      this.logger.error('Delete member error:', error);
      throw new Error('Failed to delete member');
    }
  }

  async getMemberSavings(id: string) {
    const savings = await this.prismaService.saving.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' },
    });

    return { savings };
  }

  async getMemberLoans(id: string) {
    const loans = await this.prismaService.loan.findMany({
      where: { memberId: id },
      orderBy: { applicationDate: 'desc' },
    });

    return { loans };
  }

  async getMemberShares(id: string) {
    const shares = await this.prismaService.share.findMany({
      where: { memberId: id },
      orderBy: { purchaseDate: 'desc' },
    });

    return { shares };
  }

  private async fetchMemberWithPII(column: 'id' | 'memberNumber', value: string) {
    const rows = await this.supabaseService.queryWithPII<MemberRow>(
      `
        SELECT
          m.*,
          json_build_object(
            'id', u.id,
            'email', u.email,
            'role', u."role",
            'isActive', u."isActive",
            'createdAt', u."createdAt"
          ) AS user,
          COALESCE(
            json_agg(
              jsonb_build_object(
                'id', b.id,
                'fullName', b."fullName",
                'age', b.age,
                'relationship', b.relationship
              )
            ) FILTER (WHERE b.id IS NOT NULL),
            '[]'::json
          ) AS beneficiaries
        FROM "MemberWithDecryptedPII" m
        JOIN "User" u ON u.id = m."userId"
        LEFT JOIN "Beneficiary" b ON b."memberId" = m.id
        WHERE m.${column === 'id' ? 'id' : '"memberNumber"'} = $1
        GROUP BY m.id, u.id
      `,
      [value]
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('Member not found');
    }

    const {
      idNumberEncrypted,
      phoneEncrypted,
      phoneAltEncrypted,
      nextOfKinPhoneEncrypted,
      beneficiaries,
      user,
      ...rest
    } = row as MemberRow;

    return {
      ...rest,
      Beneficiary: Array.isArray(beneficiaries) ? beneficiaries : [],
      User: user,
    };
  }
}
