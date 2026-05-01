import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccountRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../common/auth/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();

    // 1. Check if email belongs to an Organization (CENTER_ADMIN)
    const org = await this.prisma.organization.findUnique({
      where: { email },
      select: {
        id: true,
        slug: true,
        email: true,
        name: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (org) {
      if (!org.isActive) {
        throw new UnauthorizedException('Credenciales inválidas');
      }
      const passwordOk = await bcrypt.compare(dto.password, org.passwordHash);
      if (!passwordOk) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const payload: JwtPayload = {
        sub: org.id,
        email: org.email,
        tenantSlug: org.slug,
        role: AccountRole.CENTER_ADMIN,
      };

      const token = await this.signToken(payload);
      return {
        accessToken: token,
        user: {
          id: org.id,
          email: org.email,
          fullName: org.name,
          role: AccountRole.CENTER_ADMIN,
          tenantSlug: org.slug,
        },
      };
    }

    // 2. Check Professional (CENTER_MEMBER or INDEPENDENT)
    const professional = await this.prisma.professional.findUnique({
      where: { email },
      select: {
        id: true,
        slug: true,
        email: true,
        fullName: true,
        passwordHash: true,
        isActive: true,
        organizationId: true,
        organization: {
          select: { slug: true },
        },
      },
    });

    if (!professional?.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordOk = await bcrypt.compare(dto.password, professional.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMember = !!professional.organizationId;
    const tenantSlug = isMember
      ? (professional.organization?.slug ?? professional.slug)
      : professional.slug;

    const payload: JwtPayload = {
      sub: professional.id,
      email: professional.email,
      tenantSlug,
      role: isMember ? AccountRole.CENTER_MEMBER : AccountRole.INDEPENDENT,
      ...(isMember ? { organizationId: professional.organizationId! } : {}),
    };

    const token = await this.signToken(payload);
    return {
      accessToken: token,
      user: {
        id: professional.id,
        email: professional.email,
        fullName: professional.fullName,
        role: payload.role,
        tenantSlug,
        ...(isMember ? { organizationId: professional.organizationId } : {}),
      },
    };
  }

  async me(sub: string, role: AccountRole) {
    if (role === AccountRole.CENTER_ADMIN) {
      const org = await this.prisma.organization.findUniqueOrThrow({
        where: { id: sub },
        select: {
          id: true,
          slug: true,
          name: true,
          email: true,
          timezone: true,
          phone: true,
        },
      });
      return { ...org, role: AccountRole.CENTER_ADMIN };
    }

    const professional = await this.prisma.professional.findUniqueOrThrow({
      where: { id: sub },
      select: {
        id: true,
        slug: true,
        fullName: true,
        email: true,
        timezone: true,
        consultationMinutes: true,
        bufferMinutes: true,
        minRescheduleHours: true,
        standardFee: true,
        reminderHours: true,
        organizationId: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
    return { ...professional, role };
  }

  private signToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload as any, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '12h') as any,
    });
  }
}
