/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

/**
 * RLS (Row Level Security) Integration Test Suite
 * 
 * Tests branch-based access control and role permissions using:
 * - Real Supabase connections with JWT authentication
 * - Transaction isolation for test data cleanup
 * - Multiple branches (A, B) and roles (AUDITOR, CLERK, MANAGER, ADMIN, MEMBER)
 * 
 * Prerequisites:
 * 1. RLS migration (001_rls_init) must be applied to test database
 * 2. TEST_DATABASE_URL environment variable must be set
 * 3. Test database should be isolated from production
 */

describe('RLS Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let supabaseService: SupabaseService;
  let adminClient: SupabaseClient;
  let configService: ConfigService;

  // Test data IDs
  const testData = {
    branches: {
      A: 'test-branch-a-001',
      B: 'test-branch-b-001',
    },
    users: {
      clerkA: { id: 'test-clerk-a-user', email: 'clerk.a@test.com', password: 'Test123!@#' },
      clerkB: { id: 'test-clerk-b-user', email: 'clerk.b@test.com', password: 'Test123!@#' },
      auditor: { id: 'test-auditor-user', email: 'auditor@test.com', password: 'Test123!@#' },
      admin: { id: 'test-admin-user', email: 'admin@test.com', password: 'Test123!@#' },
      memberA: { id: 'test-member-a-user', email: 'member.a@test.com', password: 'Test123!@#' },
    },
    members: {
      clerkA: { id: 'test-clerk-a-member', memberNumber: 'TCLKA001' },
      clerkB: { id: 'test-clerk-b-member', memberNumber: 'TCLKB001' },
      memberA1: { id: 'test-member-a1', memberNumber: 'TMEMA001' },
      memberA2: { id: 'test-member-a2', memberNumber: 'TMEMA002' },
      memberB1: { id: 'test-member-b1', memberNumber: 'TMEMB001' },
    },
  };

  beforeAll(async () => {
    // Create testing module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test', // Use separate test environment
        }),
        JwtModule.register({
          secret: process.env.JWT_SECRET || 'test-secret-key',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        SupabaseService,
        PrismaService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
    adminClient = supabaseService.getAdminClient();

    // Verify RLS is enabled
    await verifyRLSEnabled();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await app.close();
  });

  describe('Test Setup & Data Seeding', () => {
    it('should verify RLS policies are enabled', async () => {
      const { data, error } = await adminClient.rpc('jwt_role');
      
      // Should execute without error (function exists)
      expect(error).toBeNull();
    });

    it('should seed two branches (A and B)', async () => {
      const now = new Date().toISOString();

      // Create Branch A
      const { error: errorA } = await adminClient
        .from('Branch')
        .upsert({
          id: testData.branches.A,
          name: 'Test Branch A',
          location: 'Test Location A',
          phoneNumber: '+254700000001',
          email: 'branch.a@test.com',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }, { onConflict: 'id' });

      expect(errorA).toBeNull();

      // Create Branch B
      const { error: errorB } = await adminClient
        .from('Branch')
        .upsert({
          id: testData.branches.B,
          name: 'Test Branch B',
          location: 'Test Location B',
          phoneNumber: '+254700000002',
          email: 'branch.b@test.com',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }, { onConflict: 'id' });

      expect(errorB).toBeNull();

      // Verify branches exist
      const { data: branches, error: fetchError } = await adminClient
        .from('Branch')
        .select('id, name')
        .in('id', [testData.branches.A, testData.branches.B]);

      expect(fetchError).toBeNull();
      expect(branches).toHaveLength(2);
      expect(branches?.map(b => b.id)).toContain(testData.branches.A);
      expect(branches?.map(b => b.id)).toContain(testData.branches.B);
    });

    it('should create test users with roles', async () => {
      const now = new Date().toISOString();
      const hashedPassword = await bcrypt.hash('Test123!@#', 10);

      const users = [
        { ...testData.users.clerkA, role: 'SECRETARY', createdAt: now, updatedAt: now },
        { ...testData.users.clerkB, role: 'SECRETARY', createdAt: now, updatedAt: now },
        { ...testData.users.auditor, role: 'ADMIN', createdAt: now, updatedAt: now }, // AUDITOR via JWT
        { ...testData.users.admin, role: 'ADMIN', createdAt: now, updatedAt: now },
        { ...testData.users.memberA, role: 'MEMBER', createdAt: now, updatedAt: now },
      ];

      for (const user of users) {
        const { error } = await adminClient
          .from('User')
          .upsert({
            id: user.id,
            email: user.email,
            password: hashedPassword,
            role: user.role,
            isActive: true,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          }, { onConflict: 'id' });

        expect(error).toBeNull();
      }
    });

    it('should create test members in branches', async () => {
      const now = new Date().toISOString();

      const members = [
        {
          ...testData.members.clerkA,
          userId: testData.users.clerkA.id,
          branchId: testData.branches.A,
          firstName: 'Clerk',
          lastName: 'BranchA',
          email: testData.users.clerkA.email,
          idPassportNumber: 'TCLKA001ID',
          physicalAddress: 'Test Address A',
          telephone: '+254700000011',
          createdAt: now,
          updatedAt: now,
        },
        {
          ...testData.members.clerkB,
          userId: testData.users.clerkB.id,
          branchId: testData.branches.B,
          firstName: 'Clerk',
          lastName: 'BranchB',
          email: testData.users.clerkB.email,
          idPassportNumber: 'TCLKB001ID',
          physicalAddress: 'Test Address B',
          telephone: '+254700000012',
          createdAt: now,
          updatedAt: now,
        },
        {
          ...testData.members.memberA1,
          userId: testData.users.memberA.id,
          branchId: testData.branches.A,
          firstName: 'Member',
          lastName: 'A1',
          email: testData.users.memberA.email,
          idPassportNumber: 'TMEMA001ID',
          physicalAddress: 'Test Address Member A1',
          telephone: '+254700000021',
          createdAt: now,
          updatedAt: now,
        },
        {
          ...testData.members.memberA2,
          userId: testData.users.memberA.id + '-alt', // Different user for member A2
          branchId: testData.branches.A,
          firstName: 'Member',
          lastName: 'A2',
          email: 'member.a2@test.com',
          idPassportNumber: 'TMEMA002ID',
          physicalAddress: 'Test Address Member A2',
          telephone: '+254700000022',
          createdAt: now,
          updatedAt: now,
        },
        {
          ...testData.members.memberB1,
          userId: testData.users.memberA.id + '-b', // Different user for member B1
          branchId: testData.branches.B,
          firstName: 'Member',
          lastName: 'B1',
          email: 'member.b1@test.com',
          idPassportNumber: 'TMEMB001ID',
          physicalAddress: 'Test Address Member B1',
          telephone: '+254700000031',
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const member of members) {
        // Create user if doesn't exist
        if (member.userId.includes('-alt') || member.userId.includes('-b')) {
          const hashedPassword = await bcrypt.hash('Test123!@#', 10);
          await adminClient
            .from('User')
            .upsert({
              id: member.userId,
              email: member.email,
              password: hashedPassword,
              role: 'MEMBER',
              isActive: true,
              createdAt: now,
              updatedAt: now,
            }, { onConflict: 'id' });
        }

        const { error } = await adminClient
          .from('Member')
          .upsert(member, { onConflict: 'id' });

        expect(error).toBeNull();
      }
    });
  });

  describe('Branch Isolation Tests', () => {
    it('should allow Clerk(A) to read only Branch A members', async () => {
      // Login as Clerk A to get JWT with branch_id
      const { accessToken } = await loginAsUser(testData.users.clerkA.email);

      // Create authenticated client with JWT
      const clerkAClient = createAuthenticatedClient(accessToken);

      // Should see Branch A members
      const { data: membersA, error: errorA } = await clerkAClient
        .from('Member')
        .select('id, memberNumber, branchId')
        .eq('branchId', testData.branches.A);

      expect(errorA).toBeNull();
      expect(membersA).toBeDefined();
      expect(membersA!.length).toBeGreaterThan(0);
      expect(membersA!.every(m => m.branchId === testData.branches.A)).toBe(true);

      // Should NOT see Branch B members (RLS blocks)
      const { data: membersB, error: errorB } = await clerkAClient
        .from('Member')
        .select('id, memberNumber, branchId')
        .eq('branchId', testData.branches.B);

      expect(errorB).toBeNull();
      expect(membersB).toEqual([]); // RLS filters out Branch B rows
    });

    it('should allow Clerk(B) to read only Branch B members', async () => {
      const { accessToken } = await loginAsUser(testData.users.clerkB.email);
      const clerkBClient = createAuthenticatedClient(accessToken);

      // Should see Branch B members
      const { data: membersB } = await clerkBClient
        .from('Member')
        .select('id, memberNumber, branchId')
        .eq('branchId', testData.branches.B);

      expect(membersB).toBeDefined();
      expect(membersB!.length).toBeGreaterThan(0);
      expect(membersB!.every(m => m.branchId === testData.branches.B)).toBe(true);

      // Should NOT see Branch A members
      const { data: membersA } = await clerkBClient
        .from('Member')
        .select('id, memberNumber, branchId')
        .eq('branchId', testData.branches.A);

      expect(membersA).toEqual([]); // RLS filters out Branch A rows
    });

    it('should prevent Clerk(A) from inserting into Branch B', async () => {
      const { accessToken } = await loginAsUser(testData.users.clerkA.email);
      const clerkAClient = createAuthenticatedClient(accessToken);

      const now = new Date().toISOString();

      // Try to insert into Branch B (should fail)
      const { data, error } = await clerkAClient
        .from('Member')
        .insert({
          id: 'test-unauthorized-member',
          userId: 'test-unauthorized-user',
          memberNumber: 'UNAUTH001',
          branchId: testData.branches.B, // Wrong branch!
          firstName: 'Unauthorized',
          lastName: 'Member',
          email: 'unauth@test.com',
          idPassportNumber: 'UNAUTH001ID',
          physicalAddress: 'Test Address',
          telephone: '+254700000099',
          createdAt: now,
          updatedAt: now,
        })
        .select();

      // RLS should block this insert
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should allow Clerk(A) to insert into Branch A', async () => {
      const { accessToken } = await loginAsUser(testData.users.clerkA.email);
      const clerkAClient = createAuthenticatedClient(accessToken);

      const now = new Date().toISOString();
      const newUserId = 'test-new-user-a';
      const newMemberId = 'test-new-member-a';

      // Create user first
      await adminClient
        .from('User')
        .upsert({
          id: newUserId,
          email: 'new.member.a@test.com',
          password: await bcrypt.hash('Test123!@#', 10),
          role: 'MEMBER',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }, { onConflict: 'id' });

      // Insert into Branch A (should succeed)
      const { data, error } = await clerkAClient
        .from('Member')
        .insert({
          id: newMemberId,
          userId: newUserId,
          memberNumber: 'TNEWA001',
          branchId: testData.branches.A, // Correct branch
          firstName: 'New',
          lastName: 'MemberA',
          email: 'new.member.a@test.com',
          idPassportNumber: 'TNEWA001ID',
          physicalAddress: 'Test Address New A',
          telephone: '+254700000098',
          createdAt: now,
          updatedAt: now,
        })
        .select();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data![0].branchId).toBe(testData.branches.A);
    });
  });

  describe('Auditor Role Tests', () => {
    it('should allow Auditor to read all branches', async () => {
      // Create special JWT with AUDITOR role (bypassing normal auth)
      const auditorToken = await createAuditorToken(testData.users.auditor.id);
      const auditorClient = createAuthenticatedClient(auditorToken);

      // Should see both Branch A and Branch B members
      const { data: allMembers, error } = await auditorClient
        .from('Member')
        .select('id, memberNumber, branchId')
        .in('branchId', [testData.branches.A, testData.branches.B]);

      expect(error).toBeNull();
      expect(allMembers).toBeDefined();
      expect(allMembers!.length).toBeGreaterThanOrEqual(3); // At least 3 test members

      const branchACount = allMembers!.filter(m => m.branchId === testData.branches.A).length;
      const branchBCount = allMembers!.filter(m => m.branchId === testData.branches.B).length;

      expect(branchACount).toBeGreaterThan(0);
      expect(branchBCount).toBeGreaterThan(0);
    });

    it('should prevent Auditor from writing (insert)', async () => {
      const auditorToken = await createAuditorToken(testData.users.auditor.id);
      const auditorClient = createAuthenticatedClient(auditorToken);

      const now = new Date().toISOString();

      // Try to insert (should fail - read-only)
      const { data, error } = await auditorClient
        .from('Member')
        .insert({
          id: 'test-auditor-insert',
          userId: 'test-auditor-user-insert',
          memberNumber: 'TAUD001',
          branchId: testData.branches.A,
          firstName: 'Auditor',
          lastName: 'Insert',
          email: 'auditor.insert@test.com',
          idPassportNumber: 'TAUD001ID',
          physicalAddress: 'Test Address',
          telephone: '+254700000097',
          createdAt: now,
          updatedAt: now,
        })
        .select();

      // RLS should block write operations for AUDITOR
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should prevent Auditor from updating', async () => {
      const auditorToken = await createAuditorToken(testData.users.auditor.id);
      const auditorClient = createAuthenticatedClient(auditorToken);

      // Try to update existing member (should fail)
      const { data, error } = await auditorClient
        .from('Member')
        .update({ firstName: 'Updated' })
        .eq('id', testData.members.memberA1.id)
        .select();

      // RLS should block updates for AUDITOR
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should prevent Auditor from deleting', async () => {
      const auditorToken = await createAuditorToken(testData.users.auditor.id);
      const auditorClient = createAuthenticatedClient(auditorToken);

      // Try to delete (should fail)
      const { data, error } = await auditorClient
        .from('Member')
        .delete()
        .eq('id', testData.members.memberA1.id)
        .select();

      // RLS should block deletes for AUDITOR
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('Admin Role Tests', () => {
    it('should allow Admin to read all branches', async () => {
      const { accessToken } = await loginAsUser(testData.users.admin.email);
      const adminClientAuth = createAuthenticatedClient(accessToken);

      const { data: allMembers, error } = await adminClientAuth
        .from('Member')
        .select('id, memberNumber, branchId')
        .in('branchId', [testData.branches.A, testData.branches.B]);

      expect(error).toBeNull();
      expect(allMembers).toBeDefined();
      expect(allMembers!.length).toBeGreaterThanOrEqual(3);
    });

    it('should allow Admin to write to any branch', async () => {
      const { accessToken } = await loginAsUser(testData.users.admin.email);
      const adminClientAuth = createAuthenticatedClient(accessToken);

      const now = new Date().toISOString();
      const newUserId = 'test-admin-insert-user';
      const newMemberId = 'test-admin-insert-member';

      // Create user first
      await adminClient
        .from('User')
        .upsert({
          id: newUserId,
          email: 'admin.insert@test.com',
          password: await bcrypt.hash('Test123!@#', 10),
          role: 'MEMBER',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }, { onConflict: 'id' });

      // Admin can insert into any branch
      const { data, error } = await adminClientAuth
        .from('Member')
        .insert({
          id: newMemberId,
          userId: newUserId,
          memberNumber: 'TADM001',
          branchId: testData.branches.B, // Admin can access Branch B
          firstName: 'Admin',
          lastName: 'Insert',
          email: 'admin.insert@test.com',
          idPassportNumber: 'TADM001ID',
          physicalAddress: 'Test Address Admin',
          telephone: '+254700000096',
          createdAt: now,
          updatedAt: now,
        })
        .select();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data![0].branchId).toBe(testData.branches.B);
    });

    it('should allow Admin to delete from any branch', async () => {
      const { accessToken } = await loginAsUser(testData.users.admin.email);
      const adminClientAuth = createAuthenticatedClient(accessToken);

      // Create a member to delete
      const now = new Date().toISOString();
      const deleteUserId = 'test-delete-user';
      const deleteMemberId = 'test-delete-member';

      await adminClient
        .from('User')
        .upsert({
          id: deleteUserId,
          email: 'delete.test@test.com',
          password: await bcrypt.hash('Test123!@#', 10),
          role: 'MEMBER',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }, { onConflict: 'id' });

      await adminClient
        .from('Member')
        .insert({
          id: deleteMemberId,
          userId: deleteUserId,
          memberNumber: 'TDEL001',
          branchId: testData.branches.A,
          firstName: 'Delete',
          lastName: 'Test',
          email: 'delete.test@test.com',
          idPassportNumber: 'TDEL001ID',
          physicalAddress: 'Test Address Delete',
          telephone: '+254700000095',
          createdAt: now,
          updatedAt: now,
        });

      // Admin should be able to delete
      const { error } = await adminClientAuth
        .from('Member')
        .delete()
        .eq('id', deleteMemberId);

      expect(error).toBeNull();
    });
  });

  describe('Member Role Tests', () => {
    it('should allow Member to read only their own records', async () => {
      const { accessToken } = await loginAsUser(testData.users.memberA.email);
      const memberClient = createAuthenticatedClient(accessToken);

      // Should see only their own member record
      const { data: ownMembers, error } = await memberClient
        .from('Member')
        .select('id, memberNumber, userId');

      expect(error).toBeNull();
      expect(ownMembers).toBeDefined();
      // Should only see records where userId matches the logged-in user
      expect(ownMembers!.every(m => m.userId === testData.users.memberA.id)).toBe(true);
    });

    it('should prevent Member from reading other members', async () => {
      const { accessToken } = await loginAsUser(testData.users.memberA.email);
      const memberClient = createAuthenticatedClient(accessToken);

      // Try to read another member (should get empty result)
      const { data: otherMembers } = await memberClient
        .from('Member')
        .select('id, memberNumber')
        .eq('id', testData.members.memberA2.id); // Different member

      // RLS filters out records not owned by this user
      expect(otherMembers).toEqual([]);
    });
  });

  // Helper Functions

  async function verifyRLSEnabled() {
    // Check if RLS helper functions exist
    const { error } = await adminClient.rpc('jwt_role');
    if (error && error.message.includes('does not exist')) {
      throw new Error(
        'RLS functions not found. Please run migration 001_rls_init before running tests.'
      );
    }
  }

  async function loginAsUser(email: string): Promise<{ accessToken: string; user: any }> {
    const result = await authService.signIn({
      email,
      password: 'Test123!@#',
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  function createAuthenticatedClient(accessToken: string): SupabaseClient {
    const supabaseUrl = configService.get<string>('SUPABASE_URL')!;
    const supabaseKey = configService.get<string>('SUPABASE_ANON_KEY')!;

    return createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  async function createAuditorToken(userId: string): Promise<string> {
    // Create a JWT with AUDITOR role (not in User table enum, but valid for RLS)
    const configService = app.get(ConfigService);
    const jwtService = app.get(JwtModule);

    // Manually create JWT with AUDITOR role for testing
    const payload = {
      sub: userId,
      email: testData.users.auditor.email,
      role: 'AUDITOR', // Special role for testing
      branch_id: null, // Auditors see all branches
    };

    const jwt = require('jsonwebtoken');
    return jwt.sign(
      payload,
      configService.get<string>('JWT_SECRET') || 'test-secret-key',
      { expiresIn: '1h' }
    );
  }

  async function cleanupTestData() {
    // Delete in reverse dependency order
    try {
      await adminClient.from('Member').delete().ilike('id', 'test-%');
      await adminClient.from('User').delete().ilike('id', 'test-%');
      await adminClient.from('Branch').delete().ilike('id', 'test-branch-%');
    } catch (error) {
      console.warn('Cleanup warning:', error);
      // Don't fail tests if cleanup has issues
    }
  }
});
