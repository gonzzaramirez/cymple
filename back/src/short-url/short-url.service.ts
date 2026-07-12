import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

const CODE_LENGTH = 6;
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MAX_RETRIES = 5;

@Injectable()
export class ShortUrlService {
  private readonly logger = new Logger(ShortUrlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generates a cryptographically random 6-character code from a 62-char alphabet.
   */
  generateCode(): string {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return code;
  }

  /**
   * Creates a short URL record. Retries on unique constraint violation (P2002).
   */
  async create(
    originalUrl: string,
    context?: {
      professionalId?: string;
      organizationId?: string;
      patientId?: string;
      appointmentId?: string;
    },
  ): Promise<{ code: string; originalUrl: string }> {
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      attempts++;
      const code = this.generateCode();
      try {
        const record = await this.prisma.shortUrl.create({
          data: {
            code,
            originalUrl,
            professionalId: context?.professionalId ?? null,
            organizationId: context?.organizationId ?? null,
            patientId: context?.patientId ?? null,
            appointmentId: context?.appointmentId ?? null,
          },
          select: { code: true, originalUrl: true },
        });
        return record;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          this.logger.warn(
            `Code collision on "${code}", retrying (${attempts}/${MAX_RETRIES})`,
          );
          continue;
        }
        throw error;
      }
    }

    throw new Error(
      'Failed to generate unique short URL code after max retries',
    );
  }

  /**
   * Resolves a short code back to its full record.
   */
  async findByCode(code: string) {
    return this.prisma.shortUrl.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        originalUrl: true,
        clickCount: true,
        lastClickedAt: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Increments the click count and updates lastClickedAt.
   */
  async incrementClick(id: string): Promise<void> {
    await this.prisma.shortUrl.update({
      where: { id },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: new Date(),
      },
    });
  }

  /**
   * Scans text for URLs matching the app's domain and replaces them
   * with short URLs. Creates short URLs lazily on first occurrence.
   *
   * @param text      Text containing URLs to shorten
   * @param baseUrl   Optional explicit base URL for short links (e.g. "https://demo.cymple.online/s").
   *                  When provided, short URLs use this as prefix instead of auto-detecting from env.
   */
  async shortenUrl(text: string, baseUrl?: string): Promise<string> {
    const baseDomain = this.config.get<string>('BASE_DOMAIN');
    if (!baseDomain) return text;

    const urlPattern = /https?:\/\/[^\s"'<>]+/g;
    const matches = text.match(urlPattern);
    if (!matches) return text;

    const shortUrlBase = baseUrl ?? this.buildShortUrlBase();
    let result = text;
    const processed = new Map<string, string>();

    for (const url of matches) {
      if (processed.has(url)) continue;

      if (!this.isAppUrl(url, baseDomain)) {
        processed.set(url, url);
        continue;
      }

      try {
        const short = await this.create(url);
        const shortUrl = `${shortUrlBase}/${short.code}`;
        processed.set(url, shortUrl);
      } catch (error) {
        this.logger.warn(`Failed to shorten URL: ${url}`, error);
        processed.set(url, url);
      }
    }

    // Replace all occurrences of each URL with its short version
    for (const [original, replacement] of processed) {
      if (original !== replacement) {
        result = result.split(original).join(replacement);
      }
    }

    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────

  private buildShortUrlBase(): string {
    const appPublicUrl = this.config.get<string>('APP_PUBLIC_URL');
    if (appPublicUrl) return `${appPublicUrl}/s`;

    const baseDomain = this.config.get<string>('BASE_DOMAIN');
    if (baseDomain) return `https://${baseDomain}/s`;

    return '/s';
  }

  private isAppUrl(url: string, baseDomain: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname.endsWith(`.${baseDomain}`) ||
        parsed.hostname === baseDomain ||
        parsed.hostname === 'localhost'
      );
    } catch {
      return false;
    }
  }
}
