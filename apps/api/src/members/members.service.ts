import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateMemberDto, MemberQueryDto, UpdateMemberDto } from './dto';
import { EncryptionService } from './encryption.service';
import { MemberNumberGenerator } from './member-number.generator';

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
    private readonly memberNumberGenerator: MemberNumberGenerator,
    private readonly encryptionService: EncryptionService,
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

      // Check if ID number already exists (requires checking against encrypted values)
      const existingIdMember = await this.prismaService.member.findUnique({
        where: { idPassportNumber: createMemberDto.idPassportNumber },
      });

      if (existingIdMember) {
        throw new ConflictException('ID/Passport number already registered');
      }

      // Generate unique member number: ATSC-{YYYY}-{NNNN}
      const memberNumber = await this.memberNumberGenerator.generateMemberNumber();

      // Hash password
      const hashedPassword = await bcrypt.hash(createMemberDto.password, 10);

      // Encrypt PII fields
      const idEncryption = this.encryptionService.encryptWithLast4(
        createMemberDto.idPassportNumber,
      );
      const phoneEncryption = this.encryptionService.encryptWithLast4(
        createMemberDto.telephone,
      );
      
      // Encrypt optional phone fields
      const phoneAltEncryption = createMemberDto.telephoneAlt
        ? this.encryptionService.encryptWithLast4(createMemberDto.telephoneAlt)
        : null;
      
      const nextOfKinPhoneEncryption = this.encryptionService.encryptWithLast4(
        createMemberDto.nextOfKinPhone,
      );

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
            memberNumber,
            firstName: createMemberDto.firstName,
            lastName: createMemberDto.lastName,
            middleName: createMemberDto.middleName,
            gender: createMemberDto.gender as any,
            email: createMemberDto.email,
            guardianName: createMemberDto.guardianName,
            
            // Store plaintext for queries + encrypted + last4
            idPassportNumber: createMemberDto.idPassportNumber,
            idNumberEncrypted: idEncryption.encrypted,
            idLast4: idEncryption.last4,
            
            physicalAddress: createMemberDto.physicalAddress,
            poBox: createMemberDto.poBox,
            churchGroup: createMemberDto.churchGroup,
            
            // Store plaintext + encrypted + last4 for phones
            telephone: createMemberDto.telephone,
            phoneEncrypted: phoneEncryption.encrypted,
            phoneLast4: phoneEncryption.last4,
            
            telephoneAlt: createMemberDto.telephoneAlt,
            phoneAltEncrypted: phoneAltEncryption?.encrypted,
            phoneAltLast4: phoneAltEncryption?.last4,
            
            dateOfBirth: new Date(createMemberDto.dateOfBirth),
            occupation: createMemberDto.occupation,
            employerName: createMemberDto.employerName,
            employerAddress: createMemberDto.employerAddress,
            passportPhotoUrl: createMemberDto.passportPhotoUrl,
            
            // Referee details
            refereeMemberNo: createMemberDto.refereeMemberNo,
            refereeName: createMemberDto.refereeName,
            refereePhone: createMemberDto.refereePhone,
            
            // Next of kin
            nextOfKinName: createMemberDto.nextOfKinName,
            nextOfKinPhone: createMemberDto.nextOfKinPhone,
            nextOfKinPhoneEncrypted: nextOfKinPhoneEncryption.encrypted,
            nextOfKinPhoneLast4: nextOfKinPhoneEncryption.last4,
            nextOfKinRelationship: createMemberDto.nextOfKinRelationship,
            
            // Witness
            witnessName: createMemberDto.witnessName,
            witnessDate: createMemberDto.witnessDate 
              ? new Date(createMemberDto.witnessDate) 
              : null,
            
            // Registration
            registrationFee: createMemberDto.registrationFee || 2000,
            joiningDate: new Date(),
            agreedToTerms: createMemberDto.agreedToTerms || false,
            agreedToRefundPolicy: createMemberDto.agreedToRefundPolicy || false,
            membershipStatus: 'ACTIVE',
            
            // Backoffice fields
            branchId: createMemberDto.branchId,
            verifiedBy: createMemberDto.verifiedBy,
            verifiedAt: createMemberDto.verifiedAt 
              ? new Date(createMemberDto.verifiedAt) 
              : null,
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

      this.logger.log(`Member created: ${memberNumber}`);

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
