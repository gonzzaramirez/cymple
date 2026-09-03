import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccountRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../common/auth/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      issuer: configService.get<string>('JWT_ISSUER', 'medagenda'),
      audience: configService.get<string>('JWT_AUDIENCE', 'medagenda-app'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido');
    }

    // Long-lived token (7d) hardening: revoke access at verification time
    // when the account was deactivated after the token was issued.
    if (payload.role === AccountRole.CENTER_ADMIN) {
      const org = await this.prisma.organization.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true },
      });
      if (!org || !org.isActive) {
        throw new UnauthorizedException('Cuenta desactivada');
      }
      return payload;
    }

    const professional = await this.prisma.professional.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true },
    });
    if (!professional || !professional.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }
    return payload;
  }
}
