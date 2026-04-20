import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const professional = await this.prisma.professional.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!professional?.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordOk = await bcrypt.compare(
      dto.password,
      professional.passwordHash,
    );
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = await this.jwtService.signAsync(
      {
        sub: professional.id,
        email: professional.email,
      } as any,
      {
        expiresIn: this.configService.get<string>(
          'JWT_EXPIRES_IN',
          '12h',
        ) as any,
      },
    );

    return {
      accessToken: token,
      user: {
        id: professional.id,
        email: professional.email,
        fullName: professional.fullName,
      },
    };
  }

  async me(professionalId: string) {
    return this.prisma.professional.findUniqueOrThrow({
      where: { id: professionalId },
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
      },
    });
  }
}
