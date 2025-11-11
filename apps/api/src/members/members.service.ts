import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateMemberDto, UpdateMemberDto, MemberQueryDto } from './dto';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createMemberDto: CreateMemberDto) {
    const supabase = this.supabaseService.getAdminClient();

    try {
      // Check if user email already exists
      const { data: existingUser } = await supabase
        .from('User')
        .select('id')
        .eq('email', createMemberDto.email)
        .single();

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Check if member number already exists
      const { data: existingMember } = await supabase
        .from('Member')
        .select('id')
        .eq('memberNumber', createMemberDto.memberNumber)
        .single();

      if (existingMember) {
        throw new ConflictException('Member number already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(createMemberDto.password, 10);

      // Create user
      const { data: user, error: userError } = await supabase
        .from('User')
        .insert({
          email: createMemberDto.email,
          password: hashedPassword,
          role: 'MEMBER',
          isActive: true,
        })
        .select()
        .single();

      if (userError || !user) {
        this.logger.error('Error creating user:', userError);
        throw new Error('Failed to create user');
      }

      // Create member
      const { data: member, error: memberError } = await supabase
        .from('Member')
        .insert({
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
          dateOfBirth: createMemberDto.dateOfBirth,
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
          witnessDate: createMemberDto.witnessDate,
          registrationFee: createMemberDto.registrationFee || 2000,
          agreedToTerms: createMemberDto.agreedToTerms || false,
          agreedToRefundPolicy: createMemberDto.agreedToRefundPolicy || false,
          membershipStatus: 'ACTIVE',
        })
        .select()
        .single();

      if (memberError || !member) {
        this.logger.error('Error creating member:', memberError);
        // Rollback: delete the user
        await supabase.from('User').delete().eq('id', user.id);
        throw new Error('Failed to create member');
      }

      // Create beneficiaries if provided
      if (createMemberDto.beneficiaries && createMemberDto.beneficiaries.length > 0) {
        const beneficiariesData = createMemberDto.beneficiaries.map((b) => ({
          memberId: member.id,
          fullName: b.fullName,
          age: b.age,
          relationship: b.relationship,
        }));

        await supabase.from('Beneficiary').insert(beneficiariesData);
      }

      return {
        message: 'Member created successfully',
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          firstName: member.firstName,
          lastName: member.lastName,
          email: user.email,
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
    const supabase = this.supabaseService.getAdminClient();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    let queryBuilder = supabase
      .from('Member')
      .select(`
        *,
        User!inner(email, role, isActive)
      `, { count: 'exact' });

    // Apply filters
    if (query.search) {
      queryBuilder = queryBuilder.or(
        `firstName.ilike.%${query.search}%,lastName.ilike.%${query.search}%,memberNumber.ilike.%${query.search}%`
      );
    }

    if (query.status) {
      queryBuilder = queryBuilder.eq('membershipStatus', query.status);
    }

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) {
      this.logger.error('Find all members error:', error);
      throw new Error('Failed to fetch members');
    }

    return {
      data,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async findOne(id: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('Member')
      .select(`
        *,
        User!inner(id, email, role, isActive, createdAt),
        Beneficiary(id, fullName, age, relationship)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Member not found');
    }

    return { member: data };
  }

  async findByMemberNumber(memberNumber: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('Member')
      .select(`
        *,
        User!inner(id, email, role, isActive, createdAt),
        Beneficiary(id, fullName, age, relationship)
      `)
      .eq('memberNumber', memberNumber)
      .single();

    if (error || !data) {
      throw new NotFoundException('Member not found');
    }

    return { member: data };
  }

  async update(id: string, updateMemberDto: UpdateMemberDto) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('Member')
      .update(updateMemberDto)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Member not found');
    }

    return {
      message: 'Member updated successfully',
      member: data,
    };
  }

  async remove(id: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Get member to find userId
    const { data: member } = await supabase
      .from('Member')
      .select('userId')
      .eq('id', id)
      .single();

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Delete user (cascades to member and related records)
    const { error } = await supabase
      .from('User')
      .delete()
      .eq('id', member.userId);

    if (error) {
      this.logger.error('Delete member error:', error);
      throw new Error('Failed to delete member');
    }

    return { message: 'Member deleted successfully' };
  }

  async getMemberSavings(id: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('Saving')
      .select('*')
      .eq('memberId', id)
      .order('createdAt', { ascending: false });

    if (error) {
      this.logger.error('Get member savings error:', error);
      throw new Error('Failed to fetch savings');
    }

    return { savings: data || [] };
  }

  async getMemberLoans(id: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('Loan')
      .select('*')
      .eq('memberId', id)
      .order('applicationDate', { ascending: false });

    if (error) {
      this.logger.error('Get member loans error:', error);
      throw new Error('Failed to fetch loans');
    }

    return { loans: data || [] };
  }

  async getMemberShares(id: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('Share')
      .select('*')
      .eq('memberId', id)
      .order('purchaseDate', { ascending: false });

    if (error) {
      this.logger.error('Get member shares error:', error);
      throw new Error('Failed to fetch shares');
    }

    return { shares: data || [] };
  }
}
