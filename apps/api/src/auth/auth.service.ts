import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
// import { PrismaService } from '../prisma/prisma.service'; // Not used - using Supabase SDK
import { SignUpDto, SignInDto } from './dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    // private readonly prismaService: PrismaService, // Not used - using Supabase SDK instead
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const { email, password, role = UserRole.MEMBER } = signUpDto;

    try {
      // Check if user already exists using Supabase
      const supabase = this.supabaseService.getAdminClient();
      const { data: existingUser } = await supabase
        .from('User')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user using Supabase
      const { data: newUser, error } = await supabase
        .from('User')
        .insert({
          email,
          password: hashedPassword,
          role,
          isActive: true,
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating user:', error);
        throw new Error('Failed to create user');
      }

      // Generate tokens
      const tokens = await this.generateTokens(newUser.id, newUser.email, newUser.role);

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          isActive: newUser.isActive,
        },
        ...tokens,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Sign up error:', error);
      throw new Error('Failed to sign up');
    }
  }

  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;

    try {
      // Fetch user using Supabase
      const supabase = this.supabaseService.getAdminClient();
      const { data: user, error } = await supabase
        .from('User')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
        ...tokens,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Sign in error:', error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async signOut(_userId: string) {
    // In a production app, you might want to invalidate the refresh token
    // For now, just return success (client will clear tokens)
    return { message: 'Signed out successfully' };
  }

  async getCurrentUser(userId: string) {
    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data: user, error } = await supabase
        .from('User')
        .select(`
          id,
          email,
          role,
          isActive,
          createdAt,
          Member (
            id,
            memberNumber,
            firstName,
            lastName,
            telephone,
            membershipStatus
          )
        `)
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new UnauthorizedException('User not found');
      }

      return { user };
    } catch (error) {
      this.logger.error('Get current user error:', error);
      throw new UnauthorizedException('User not found');
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 
                this.configService.get<string>('JWT_SECRET'),
      });

      // Regenerate tokens with the same user info (including branch_id)
      const tokens = await this.generateTokens(payload.sub, payload.email, payload.role);
      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(userId: string, email: string, role: UserRole) {
    // Fetch member's branch_id for RLS policies
    let branchId: string | null = null;
    
    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data: member } = await supabase
        .from('Member')
        .select('branchId')
        .eq('userId', userId)
        .single();
      
      branchId = member?.branchId || null;
    } catch (error) {
      this.logger.warn(`Could not fetch branchId for user ${userId}:`, error);
      // Continue without branchId - some users (like new signups) may not have a member record yet
    }

    // Include branch_id in JWT payload for RLS policies
    const payload = { 
      sub: userId, 
      email, 
      role,
      branch_id: branchId  // Required by RLS policies
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION') || '1h',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 
                this.configService.get<string>('JWT_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
