import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { CompanyMembershipRole } from '../common/types/company-membership-role.type';
import { db } from '../db';
import {
  companies,
  companyMembershipTeams,
  companyMemberships,
  teams,
  users,
} from '../db/schema';
import { CreatePlatformCompanyMembershipDto } from './dto/create-platform-company-membership.dto';
import { CreatePlatformCompanyDto } from './dto/create-platform-company.dto';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { UpdatePlatformCompanyMembershipDto } from './dto/update-platform-company-membership.dto';
import { UpdatePlatformCompanyDto } from './dto/update-platform-company.dto';
import { UpdatePlatformUserDto } from './dto/update-platform-user.dto';

type PlatformTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  favicon_path: string | null;
  address: string;
  nif: string;
  mobile_phone: string;
  email: string;
  iban: string;
  created_at: Date;
};

type CompanyMembershipRow = {
  id: string;
  company_id: string;
  company_name: string;
  user_id: string | null;
  email: string | null;
  role: CompanyMembershipRole;
  name: string;
  phone: string | null;
  active: boolean;
  created_at: Date;
};

type UserRow = {
  id: string;
  email: string;
  is_super_admin: boolean;
  created_at: Date;
};

type CompanyRecord = CompanyRow & {
  member_count: number;
  active_admin_count: number;
};

type UserRecord = UserRow & {
  membership_count: number;
};

type ExistingUserSource = {
  mode: 'existing';
  userId: string;
};

type NewUserSource = {
  mode: 'new';
  email: string;
  password: string;
};

@Injectable()
export class PlatformService {
  async listCompanies() {
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        logo_path: companies.logoPath,
        favicon_path: companies.faviconPath,
        address: companies.address,
        nif: companies.nif,
        mobile_phone: companies.mobilePhone,
        email: companies.email,
        iban: companies.iban,
        created_at: companies.createdAt,
      })
      .from(companies)
      .orderBy(asc(companies.name));

    return this.attachCompanyStats(rows);
  }

  async findCompanyById(companyId: string) {
    const company = await this.findCompanyRecord(companyId);
    if (!company) {
      return null;
    }

    const [withStats] = await this.attachCompanyStats([company]);
    return withStats ?? null;
  }

  async createCompany(dto: CreatePlatformCompanyDto) {
    const normalizedSlug = this.normalizeRequired(dto.slug, 'slug').toLowerCase();
    const normalizedEmail = this.normalizeEmail(dto.email);
    const initialAdminName = this.normalizeRequired(
      dto.initial_admin_name,
      'initial_admin_name',
    );
    const initialAdminSource = this.resolveInitialAdminSource(dto);

    const companyId = await db.transaction(async (tx) => {
      await this.assertCompanySlugAvailable(tx, normalizedSlug);

      const insertedCompanies = await tx
        .insert(companies)
        .values({
          name: this.normalizeRequired(dto.name, 'name'),
          slug: normalizedSlug,
          logoPath: this.normalizeNullable(dto.logo_path),
          faviconPath: this.normalizeNullable(dto.favicon_path),
          address: this.normalizeRequired(dto.address, 'address'),
          nif: this.normalizeRequired(dto.nif, 'nif'),
          mobilePhone: this.normalizeRequired(dto.mobile_phone, 'mobile_phone'),
          email: normalizedEmail,
          iban: this.normalizeRequired(dto.iban, 'iban'),
        })
        .returning({ id: companies.id });

      const companyId = insertedCompanies[0]?.id;
      if (!companyId) {
        throw new BadRequestException('Failed to create company');
      }

      const userId = await this.resolveMembershipUserId(tx, initialAdminSource, {
        allowSuperAdmin: false,
      });

      await tx.insert(companyMemberships).values({
        companyId,
        userId,
        role: 'admin',
        name: initialAdminName,
        phone: this.normalizeNullable(dto.initial_admin_phone),
        active: true,
      });

      return companyId;
    });

    return this.findCompanyById(companyId);
  }

  async updateCompany(companyId: string, dto: UpdatePlatformCompanyDto) {
    const current = await this.findCompanyRecord(companyId);
    if (!current) {
      return null;
    }

    const setPayload: {
      name?: string;
      slug?: string;
      logoPath?: string | null;
      faviconPath?: string | null;
      address?: string;
      nif?: string;
      mobilePhone?: string;
      email?: string;
      iban?: string;
    } = {};

    if (dto.name !== undefined) {
      setPayload.name = this.normalizeRequired(dto.name, 'name');
    }

    if (dto.slug !== undefined) {
      const slug = this.normalizeRequired(dto.slug, 'slug').toLowerCase();
      await this.assertCompanySlugAvailable(db, slug, companyId);
      setPayload.slug = slug;
    }

    if (dto.logo_path !== undefined) {
      setPayload.logoPath = this.normalizeNullable(dto.logo_path);
    }

    if (dto.favicon_path !== undefined) {
      setPayload.faviconPath = this.normalizeNullable(dto.favicon_path);
    }

    if (dto.address !== undefined) {
      setPayload.address = this.normalizeRequired(dto.address, 'address');
    }

    if (dto.nif !== undefined) {
      setPayload.nif = this.normalizeRequired(dto.nif, 'nif');
    }

    if (dto.mobile_phone !== undefined) {
      setPayload.mobilePhone = this.normalizeRequired(
        dto.mobile_phone,
        'mobile_phone',
      );
    }

    if (dto.email !== undefined) {
      setPayload.email = this.normalizeEmail(dto.email);
    }

    if (dto.iban !== undefined) {
      setPayload.iban = this.normalizeRequired(dto.iban, 'iban');
    }

    if (Object.keys(setPayload).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    const updated = await db
      .update(companies)
      .set(setPayload)
      .where(eq(companies.id, companyId))
      .returning({ id: companies.id });

    if (updated.length === 0) {
      return null;
    }

    return this.findCompanyById(companyId);
  }

  async deleteCompany(companyId: string) {
    const deleted = await db
      .delete(companies)
      .where(eq(companies.id, companyId))
      .returning({ id: companies.id });

    return deleted.length > 0;
  }

  async listCompanyMemberships(companyId: string) {
    await this.assertCompanyExists(companyId);

    const rows = (await db
      .select({
        id: companyMemberships.id,
        company_id: companyMemberships.companyId,
        company_name: companies.name,
        user_id: companyMemberships.userId,
        email: users.email,
        role: companyMemberships.role,
        name: companyMemberships.name,
        phone: companyMemberships.phone,
        active: companyMemberships.active,
        created_at: companyMemberships.createdAt,
      })
      .from(companyMemberships)
      .innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .leftJoin(users, eq(companyMemberships.userId, users.id))
      .where(eq(companyMemberships.companyId, companyId))
      .orderBy(desc(companyMemberships.createdAt))) as CompanyMembershipRow[];

    return this.attachTeamIds(rows);
  }

  async createCompanyMembership(
    companyId: string,
    dto: CreatePlatformCompanyMembershipDto,
  ) {
    await this.assertCompanyExists(companyId);

    const teamIds = this.normalizeTeamIds(dto.team_ids);
    await this.assertValidTeamIds(companyId, teamIds);
    const membershipSource = this.resolveMembershipSource(dto);

    const membershipId = await db.transaction(async (tx) => {
      const userId = await this.resolveMembershipUserId(tx, membershipSource);
      await this.assertCompanyUserMembershipAvailable(tx, companyId, userId);

      const insertedMemberships = await tx
        .insert(companyMemberships)
        .values({
          companyId,
          userId,
          role: dto.role,
          name: this.normalizeRequired(dto.name, 'name'),
          phone: this.normalizeNullable(dto.phone),
          active: dto.active ?? true,
        })
        .returning({ id: companyMemberships.id });

      const membershipId = insertedMemberships[0]?.id;
      if (!membershipId) {
        throw new BadRequestException('Failed to create company membership');
      }

      if (teamIds.length > 0) {
        await tx.insert(companyMembershipTeams).values(
          teamIds.map((teamId) => ({
            companyId,
            companyMembershipId: membershipId,
            teamId,
          })),
        );
      }

      return membershipId;
    });

    return this.findCompanyMembershipById(membershipId);
  }

  async updateCompanyMembership(
    membershipId: string,
    dto: UpdatePlatformCompanyMembershipDto,
  ) {
    const current = await this.findMembershipRecordById(membershipId);
    if (!current) {
      return null;
    }

    const nextRole = dto.role ?? current.role;
    const nextActive = dto.active ?? current.active;
    const teamIds =
      dto.team_ids !== undefined ? this.normalizeTeamIds(dto.team_ids) : undefined;

    if (teamIds !== undefined) {
      await this.assertValidTeamIds(current.company_id, teamIds);
    }

    await db.transaction(async (tx) => {
      await this.assertMembershipAdminIntegrity(tx, current, nextRole, nextActive);

      const setPayload: {
        role?: CompanyMembershipRole;
        name?: string;
        phone?: string | null;
        active?: boolean;
      } = {};

      if (dto.role !== undefined) {
        setPayload.role = dto.role;
      }

      if (dto.name !== undefined) {
        setPayload.name = this.normalizeRequired(dto.name, 'name');
      }

      if (dto.phone !== undefined) {
        setPayload.phone = this.normalizeNullable(dto.phone);
      }

      if (dto.active !== undefined) {
        setPayload.active = dto.active;
      }

      if (Object.keys(setPayload).length === 0 && teamIds === undefined) {
        throw new BadRequestException('No fields provided for update');
      }

      if (Object.keys(setPayload).length > 0) {
        const updated = await tx
          .update(companyMemberships)
          .set(setPayload)
          .where(eq(companyMemberships.id, membershipId))
          .returning({ id: companyMemberships.id });

        if (updated.length === 0) {
          throw new NotFoundException('Company membership not found');
        }
      }

      if (teamIds !== undefined) {
        await tx
          .delete(companyMembershipTeams)
          .where(
            and(
              eq(companyMembershipTeams.companyMembershipId, membershipId),
              eq(companyMembershipTeams.companyId, current.company_id),
            ),
          );

        if (teamIds.length > 0) {
          await tx.insert(companyMembershipTeams).values(
            teamIds.map((teamId) => ({
              companyId: current.company_id,
              companyMembershipId: membershipId,
              teamId,
            })),
          );
        }
      }
    });

    return this.findCompanyMembershipById(membershipId);
  }

  async deleteCompanyMembership(membershipId: string) {
    const current = await this.findMembershipRecordById(membershipId);
    if (!current) {
      return false;
    }

    await db.transaction(async (tx) => {
      await this.assertMembershipAdminIntegrity(
        tx,
        current,
        current.role,
        false,
        true,
      );

      await tx.delete(companyMemberships).where(eq(companyMemberships.id, membershipId));
    });

    return true;
  }

  async listUsers() {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        is_super_admin: users.isSuperAdmin,
        created_at: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.email));

    return this.attachUserStats(rows);
  }

  async findUserById(userId: string) {
    const user = await this.findUserRecord(userId);
    if (!user) {
      return null;
    }

    const [withStats] = await this.attachUserStats([user]);
    const memberships = await this.listMembershipsForUsers([userId]);

    return {
      ...withStats,
      memberships: memberships.get(userId) ?? [],
    };
  }

  async createUser(dto: CreatePlatformUserDto) {
    const email = this.normalizeEmail(dto.email);
    await this.assertUserEmailAvailable(email);

    const insertedUsers = await db
      .insert(users)
      .values({
        email,
        passwordHash: await hash(dto.password.trim(), 10),
        isSuperAdmin: dto.is_super_admin ?? false,
      })
      .returning({ id: users.id });

    const userId = insertedUsers[0]?.id;
    if (!userId) {
      throw new BadRequestException('Failed to create user');
    }

    return this.findUserById(userId);
  }

  async updateUser(userId: string, dto: UpdatePlatformUserDto) {
    const current = await this.findUserRecord(userId);
    if (!current) {
      return null;
    }

    const setPayload: {
      email?: string;
      passwordHash?: string;
      isSuperAdmin?: boolean;
    } = {};

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      await this.assertUserEmailAvailable(email, userId);
      setPayload.email = email;
    }

    if (dto.password !== undefined) {
      setPayload.passwordHash = await hash(dto.password.trim(), 10);
    }

    if (dto.is_super_admin !== undefined) {
      await this.assertSuperAdminRetention(current, dto.is_super_admin, false);
      setPayload.isSuperAdmin = dto.is_super_admin;
    }

    if (Object.keys(setPayload).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    const updated = await db
      .update(users)
      .set(setPayload)
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (updated.length === 0) {
      return null;
    }

    return this.findUserById(userId);
  }

  async deleteUser(userId: string) {
    const current = await this.findUserRecord(userId);
    if (!current) {
      return false;
    }

    await this.assertSuperAdminRetention(current, false, true);

    const memberships = await this.findMembershipsByUserId(userId);

    await db.transaction(async (tx) => {
      for (const membership of memberships) {
        await this.assertMembershipAdminIntegrity(
          tx,
          membership,
          membership.role,
          false,
          true,
        );
      }

      await tx.delete(companyMemberships).where(eq(companyMemberships.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });

    return true;
  }

  async listTeamsByCompany(companyId: string) {
    await this.assertCompanyExists(companyId);

    return db
      .select({
        id: teams.id,
        company_id: teams.companyId,
        name: teams.name,
        created_at: teams.createdAt,
      })
      .from(teams)
      .where(eq(teams.companyId, companyId))
      .orderBy(asc(teams.name));
  }

  private async findCompanyMembershipById(membershipId: string) {
    const membership = await this.findMembershipRecordById(membershipId);
    if (!membership) {
      return null;
    }

    const [withTeams] = await this.attachTeamIds([membership]);
    return withTeams ?? null;
  }

  private async findCompanyRecord(companyId: string) {
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        logo_path: companies.logoPath,
        favicon_path: companies.faviconPath,
        address: companies.address,
        nif: companies.nif,
        mobile_phone: companies.mobilePhone,
        email: companies.email,
        iban: companies.iban,
        created_at: companies.createdAt,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    return rows[0] ?? null;
  }

  private async findMembershipRecordById(membershipId: string) {
    const rows = (await db
      .select({
        id: companyMemberships.id,
        company_id: companyMemberships.companyId,
        company_name: companies.name,
        user_id: companyMemberships.userId,
        email: users.email,
        role: companyMemberships.role,
        name: companyMemberships.name,
        phone: companyMemberships.phone,
        active: companyMemberships.active,
        created_at: companyMemberships.createdAt,
      })
      .from(companyMemberships)
      .innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .leftJoin(users, eq(companyMemberships.userId, users.id))
      .where(eq(companyMemberships.id, membershipId))
      .limit(1)) as CompanyMembershipRow[];

    return rows[0] ?? null;
  }

  private async findMembershipsByUserId(userId: string) {
    return (await db
      .select({
        id: companyMemberships.id,
        company_id: companyMemberships.companyId,
        company_name: companies.name,
        user_id: companyMemberships.userId,
        email: users.email,
        role: companyMemberships.role,
        name: companyMemberships.name,
        phone: companyMemberships.phone,
        active: companyMemberships.active,
        created_at: companyMemberships.createdAt,
      })
      .from(companyMemberships)
      .innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .leftJoin(users, eq(companyMemberships.userId, users.id))
      .where(eq(companyMemberships.userId, userId))) as CompanyMembershipRow[];
  }

  private async findUserRecord(userId: string) {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        is_super_admin: users.isSuperAdmin,
        created_at: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return rows[0] ?? null;
  }

  private async attachCompanyStats(rows: CompanyRow[]): Promise<CompanyRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    const memberships = await db
      .select({
        company_id: companyMemberships.companyId,
        role: companyMemberships.role,
        active: companyMemberships.active,
      })
      .from(companyMemberships)
      .where(
        inArray(
          companyMemberships.companyId,
          rows.map((row) => row.id),
        ),
      );

    const stats = new Map<
      string,
      {
        memberCount: number;
        activeAdminCount: number;
      }
    >();

    for (const membership of memberships) {
      const current = stats.get(membership.company_id) ?? {
        memberCount: 0,
        activeAdminCount: 0,
      };

      current.memberCount += 1;
      if (membership.active && membership.role === 'admin') {
        current.activeAdminCount += 1;
      }

      stats.set(membership.company_id, current);
    }

    return rows.map((row) => {
      const current = stats.get(row.id);
      return {
        ...row,
        member_count: current?.memberCount ?? 0,
        active_admin_count: current?.activeAdminCount ?? 0,
      };
    });
  }

  private async attachUserStats(rows: UserRow[]): Promise<UserRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    const memberships = await db
      .select({
        user_id: companyMemberships.userId,
      })
      .from(companyMemberships)
      .where(
        inArray(
          companyMemberships.userId,
          rows.map((row) => row.id),
        ),
      );

    const counts = new Map<string, number>();
    for (const membership of memberships) {
      if (!membership.user_id) {
        continue;
      }

      counts.set(membership.user_id, (counts.get(membership.user_id) ?? 0) + 1);
    }

    return rows.map((row) => ({
      ...row,
      membership_count: counts.get(row.id) ?? 0,
    }));
  }

  private async listMembershipsForUsers(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, Array<CompanyMembershipRow & { team_ids: string[] }>>();
    }

    const memberships = (await db
      .select({
        id: companyMemberships.id,
        company_id: companyMemberships.companyId,
        company_name: companies.name,
        user_id: companyMemberships.userId,
        email: users.email,
        role: companyMemberships.role,
        name: companyMemberships.name,
        phone: companyMemberships.phone,
        active: companyMemberships.active,
        created_at: companyMemberships.createdAt,
      })
      .from(companyMemberships)
      .innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .leftJoin(users, eq(companyMemberships.userId, users.id))
      .where(inArray(companyMemberships.userId, userIds))
      .orderBy(desc(companyMemberships.createdAt))) as CompanyMembershipRow[];

    const withTeams = await this.attachTeamIds(memberships);
    const map = new Map<string, Array<CompanyMembershipRow & { team_ids: string[] }>>();

    for (const membership of withTeams) {
      if (!membership.user_id) {
        continue;
      }

      const current = map.get(membership.user_id) ?? [];
      current.push(membership);
      map.set(membership.user_id, current);
    }

    return map;
  }

  private async attachTeamIds(rows: CompanyMembershipRow[]) {
    if (rows.length === 0) {
      return [];
    }

    const mappings = await db
      .select({
        company_membership_id: companyMembershipTeams.companyMembershipId,
        team_id: companyMembershipTeams.teamId,
      })
      .from(companyMembershipTeams)
      .where(
        inArray(
          companyMembershipTeams.companyMembershipId,
          rows.map((row) => row.id),
        ),
      );

    const teamMap = new Map<string, string[]>();
    for (const mapping of mappings) {
      const current = teamMap.get(mapping.company_membership_id) ?? [];
      current.push(mapping.team_id);
      teamMap.set(mapping.company_membership_id, current);
    }

    return rows.map((row) => ({
      ...row,
      team_ids: teamMap.get(row.id) ?? [],
    }));
  }

  private async assertCompanyExists(companyId: string) {
    const company = await this.findCompanyRecord(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
  }

  private async assertCompanySlugAvailable(
    executor: PlatformTx | typeof db,
    slug: string,
    companyId?: string,
  ) {
    const filters = [eq(companies.slug, slug)];

    if (companyId) {
      filters.push(ne(companies.id, companyId));
    }

    const existing = await executor
      .select({ id: companies.id })
      .from(companies)
      .where(and(...filters))
      .limit(1);

    if (existing[0]) {
      throw new ConflictException('Company slug already exists');
    }
  }

  private async assertUserEmailAvailable(email: string, userId?: string) {
    const filters = [eq(users.email, email)];

    if (userId) {
      filters.push(ne(users.id, userId));
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(...filters))
      .limit(1);

    if (existing[0]) {
      throw new ConflictException('User email already exists');
    }
  }

  private async assertCompanyUserMembershipAvailable(
    executor: PlatformTx,
    companyId: string,
    userId: string,
  ) {
    const existing = await executor
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.userId, userId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      throw new ConflictException(
        'Company membership already exists for this company and user',
      );
    }
  }

  private async assertValidTeamIds(companyId: string, teamIds: string[]) {
    if (teamIds.length === 0) {
      return;
    }

    const existing = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.companyId, companyId), inArray(teams.id, teamIds)));

    const existingIds = new Set(existing.map((team) => team.id));
    const invalidTeamIds = teamIds.filter((teamId) => !existingIds.has(teamId));

    if (invalidTeamIds.length > 0) {
      throw new BadRequestException({
        message: 'Invalid team_ids for company',
        invalid_team_ids: invalidTeamIds,
      });
    }
  }

  private resolveInitialAdminSource(
    dto: CreatePlatformCompanyDto,
  ): ExistingUserSource | NewUserSource {
    const hasExistingUser = Boolean(dto.initial_admin_user_id);
    const hasNewUser = Boolean(dto.initial_admin_email || dto.initial_admin_password);

    if (hasExistingUser === hasNewUser) {
      throw new BadRequestException(
        'Choose exactly one initial admin source: existing user or new user',
      );
    }

    if (hasExistingUser) {
      return {
        mode: 'existing',
        userId: dto.initial_admin_user_id!,
      };
    }

    if (!dto.initial_admin_email || !dto.initial_admin_password) {
      throw new BadRequestException(
        'initial_admin_email and initial_admin_password are required when creating a new initial admin',
      );
    }

    return {
      mode: 'new',
      email: this.normalizeEmail(dto.initial_admin_email),
      password: dto.initial_admin_password.trim(),
    };
  }

  private resolveMembershipSource(
    dto: CreatePlatformCompanyMembershipDto,
  ): ExistingUserSource | NewUserSource {
    const hasExistingUser = Boolean(dto.existing_user_id);
    const hasNewUser = Boolean(dto.email || dto.password);

    if (hasExistingUser === hasNewUser) {
      throw new BadRequestException(
        'Choose exactly one membership user source: existing user or new user',
      );
    }

    if (hasExistingUser) {
      return {
        mode: 'existing',
        userId: dto.existing_user_id!,
      };
    }

    if (!dto.email || !dto.password) {
      throw new BadRequestException(
        'email and password are required when creating a new user for membership',
      );
    }

    return {
      mode: 'new',
      email: this.normalizeEmail(dto.email),
      password: dto.password.trim(),
    };
  }

  private async resolveMembershipUserId(
    executor: PlatformTx,
    source: ExistingUserSource | NewUserSource,
    options?: { allowSuperAdmin?: boolean },
  ) {
    if (source.mode === 'existing') {
      const existingUser = await executor
        .select({ id: users.id, is_super_admin: users.isSuperAdmin })
        .from(users)
        .where(eq(users.id, source.userId))
        .limit(1);

      if (!existingUser[0]) {
        throw new NotFoundException('User not found');
      }

      if (
        options?.allowSuperAdmin === false &&
        existingUser[0].is_super_admin
      ) {
        throw new BadRequestException(
          'A super admin account cannot be used as the initial company admin',
        );
      }

      return existingUser[0].id;
    }

    const existingByEmail = await executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, source.email))
      .limit(1);

    if (existingByEmail[0]) {
      throw new ConflictException(
        'User email already exists. Select the existing user instead.',
      );
    }

    const insertedUsers = await executor
      .insert(users)
      .values({
        email: source.email,
        passwordHash: await hash(source.password, 10),
      })
      .returning({ id: users.id });

    const userId = insertedUsers[0]?.id;
    if (!userId) {
      throw new BadRequestException('Failed to create user');
    }

    return userId;
  }

  private async assertMembershipAdminIntegrity(
    executor: PlatformTx,
    current: CompanyMembershipRow,
    nextRole: CompanyMembershipRole,
    nextActive: boolean,
    deleting = false,
  ) {
    const removesActiveAdmin =
      current.role === 'admin' &&
      current.active &&
      (deleting || nextRole !== 'admin' || !nextActive);

    if (!removesActiveAdmin) {
      return;
    }

    const alternativeAdmin = await executor
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, current.company_id),
          eq(companyMemberships.role, 'admin'),
          eq(companyMemberships.active, true),
          ne(companyMemberships.id, current.id),
        ),
      )
      .limit(1);

    if (!alternativeAdmin[0]) {
      throw new BadRequestException(
        'Every company must keep at least one active admin',
      );
    }
  }

  private async assertSuperAdminRetention(
    current: UserRow,
    nextIsSuperAdmin: boolean,
    deleting: boolean,
  ) {
    const removesSuperAdmin = current.is_super_admin && (deleting || !nextIsSuperAdmin);

    if (!removesSuperAdmin) {
      return;
    }

    const otherSuperAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isSuperAdmin, true), ne(users.id, current.id)))
      .limit(1);

    if (!otherSuperAdmin[0]) {
      throw new BadRequestException(
        'At least one super admin account must remain active',
      );
    }
  }

  private normalizeRequired(value: string, field: string) {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }

    return normalized;
  }

  private normalizeNullable(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeEmail(value: string) {
    return this.normalizeRequired(value, 'email').toLowerCase();
  }

  private normalizeTeamIds(teamIds?: string[]) {
    if (!teamIds) {
      return [];
    }

    return [...new Set(teamIds.map((teamId) => teamId.trim()).filter(Boolean))];
  }
}
