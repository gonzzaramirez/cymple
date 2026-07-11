import * as crypto from 'crypto';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ShortUrlService } from './short-url.service';
import { PrismaService } from '../common/prisma/prisma.service';

// ── Helpers ────────────────────────────────────────────────────────────

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

describe('ShortUrlService', () => {
  let prismaMock: jest.Mocked<Pick<PrismaService, 'shortUrl'>>;
  let configMock: jest.Mocked<Pick<ConfigService, 'get'>>;
  let service: ShortUrlService;

  beforeEach(() => {
    prismaMock = {
      shortUrl: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      } as any,
    };
    configMock = {
      get: jest.fn(),
    };
    service = new ShortUrlService(prismaMock as any, configMock as any);
  });

  // ===================================================================
  // 5.1 — Unit: Code generation + collision retry
  // ===================================================================

  describe('generateCode', () => {
    it('should return a 6-character string', () => {
      const code = service.generateCode();
      expect(code).toHaveLength(6);
    });

    it('should only contain characters from the 62-char alphabet', () => {
      const code = service.generateCode();
      for (const ch of code) {
        expect(ALPHABET).toContain(ch);
      }
    });

    it('should produce different codes on successive calls', () => {
      const code1 = service.generateCode();
      const code2 = service.generateCode();
      expect(code1).not.toBe(code2);
    });
  });

  describe('create', () => {
    it('should create a short URL and return code + originalUrl', async () => {
      const mockRecord = { code: 'aB3xYz', originalUrl: 'https://example.com/long-url' };
      (prismaMock.shortUrl.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await service.create('https://example.com/long-url');

      expect(result).toEqual(mockRecord);
      expect(result.code).toHaveLength(6);
      expect(prismaMock.shortUrl.create).toHaveBeenCalledTimes(1);
    });

    it('should retry on P2002 unique constraint violation', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.16.1',
      });
      const mockRecord = { code: 'bC4yWz', originalUrl: 'https://example.com/retry' };

      (prismaMock.shortUrl.create as jest.Mock)
        .mockRejectedValueOnce(p2002)
        .mockResolvedValueOnce(mockRecord);

      const result = await service.create('https://example.com/retry');

      expect(result).toEqual(mockRecord);
      expect(prismaMock.shortUrl.create).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exhausted', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.16.1',
      });
      (prismaMock.shortUrl.create as jest.Mock).mockRejectedValue(p2002);

      await expect(service.create('https://example.com/nope')).rejects.toThrow(
        'Failed to generate unique short URL code after max retries',
      );
      // Called 5 times (the max attempts)
      expect(prismaMock.shortUrl.create).toHaveBeenCalledTimes(5);
    });

    it('should rethrow non-P2002 errors', async () => {
      const dbError = new Error('connection refused');
      (prismaMock.shortUrl.create as jest.Mock).mockRejectedValue(dbError);

      await expect(service.create('https://example.com/error')).rejects.toThrow(
        'connection refused',
      );
      expect(prismaMock.shortUrl.create).toHaveBeenCalledTimes(1);
    });
  });

  // ===================================================================
  // 5.2 — Unit: shortenUrl() text replacement
  // ===================================================================

  describe('shortenUrl', () => {
    it('should replace app-domain URLs with short URLs in text', async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'BASE_DOMAIN') return 'cymple.online';
        if (key === 'APP_PUBLIC_URL') return 'https://app.cymple.online';
        return undefined;
      });

      (prismaMock.shortUrl.create as jest.Mock).mockResolvedValue({
        code: 'xY8P3k',
        originalUrl: 'https://doctor.cymple.online/ficha/abc-123',
      });

      const text =
        'Completá tu ficha: https://doctor.cymple.online/ficha/abc-123 Gracias!';
      const result = await service.shortenUrl(text);

      expect(result).toBe(
        'Completá tu ficha: https://app.cymple.online/s/xY8P3k Gracias!',
      );
    });

    it('should return text unchanged if no URLs match app domain', async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'BASE_DOMAIN') return 'cymple.online';
        return undefined;
      });

      const text = 'Hola! Cómo estás?';
      const result = await service.shortenUrl(text);
      expect(result).toBe(text);
      expect(prismaMock.shortUrl.create).not.toHaveBeenCalled();
    });

    it('should skip non-app-domain URLs', async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'BASE_DOMAIN') return 'cymple.online';
        return undefined;
      });

      const text =
        'Check https://google.com and https://doctor.cymple.online/ficha/xyz';
      (prismaMock.shortUrl.create as jest.Mock).mockResolvedValue({
        code: 'aBc123',
        originalUrl: 'https://doctor.cymple.online/ficha/xyz',
      });

      const result = await service.shortenUrl(text);

      // Only the cymple.online URL should be replaced
      expect(result).toContain('https://google.com');
      expect(result).not.toContain('https://doctor.cymple.online/ficha/xyz');
    });

    it('should skip URL shortening if BASE_DOMAIN is not configured', async () => {
      configMock.get.mockReturnValue(undefined);

      const text = 'Some text with https://example.com/url';
      const result = await service.shortenUrl(text);
      expect(result).toBe(text);
      expect(prismaMock.shortUrl.create).not.toHaveBeenCalled();
    });

    it('should handle multiple app-domain URLs in the same text', async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'BASE_DOMAIN') return 'cymple.online';
        if (key === 'APP_PUBLIC_URL') return 'https://app.cymple.online';
        return undefined;
      });

      const createMock = jest.fn()
        .mockResolvedValueOnce({ code: 'abc111', originalUrl: 'https://d1.cymple.online/a' })
        .mockResolvedValueOnce({ code: 'abc222', originalUrl: 'https://d2.cymple.online/b' });
      (prismaMock.shortUrl.create as jest.Mock).mockImplementation(createMock);

      const text =
        'URL1: https://d1.cymple.online/a and URL2: https://d2.cymple.online/b';
      const result = await service.shortenUrl(text);

      expect(result).toContain('https://app.cymple.online/s/abc111');
      expect(result).toContain('https://app.cymple.online/s/abc222');
      expect(prismaMock.shortUrl.create).toHaveBeenCalledTimes(2);
    });

    it('should not shorten the same URL twice', async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'BASE_DOMAIN') return 'cymple.online';
        if (key === 'APP_PUBLIC_URL') return 'https://app.cymple.online';
        return undefined;
      });

      (prismaMock.shortUrl.create as jest.Mock).mockResolvedValue({
        code: 'abc333',
        originalUrl: 'https://doc.cymple.online/ficha/xyz',
      });

      const text =
        'Link: https://doc.cymple.online/ficha/xyz and https://doc.cymple.online/ficha/xyz again';
      const result = await service.shortenUrl(text);

      // Both occurrences replaced with the same short code
      expect(result).toBe(
        'Link: https://app.cymple.online/s/abc333 and https://app.cymple.online/s/abc333 again',
      );
      expect(prismaMock.shortUrl.create).toHaveBeenCalledTimes(1);
    });
  });

  // ===================================================================
  // 5.3 — Integration: CRUD + click tracking (with mocked Prisma)
  // ===================================================================

  describe('findByCode', () => {
    it('should return the short URL record for a valid code', async () => {
      const mockRecord = {
        id: 'id-1',
        code: 'aB3xYz',
        originalUrl: 'https://example.com/long',
        clickCount: 0,
        lastClickedAt: null,
        expiresAt: null,
      };
      (prismaMock.shortUrl.findUnique as jest.Mock).mockResolvedValue(mockRecord);

      const result = await service.findByCode('aB3xYz');

      expect(result).toEqual(mockRecord);
      expect(prismaMock.shortUrl.findUnique).toHaveBeenCalledWith({
        where: { code: 'aB3xYz' },
        select: {
          id: true,
          code: true,
          originalUrl: true,
          clickCount: true,
          lastClickedAt: true,
          expiresAt: true,
        },
      });
    });

    it('should return null for an unknown code', async () => {
      (prismaMock.shortUrl.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findByCode('ZZZZZZ');

      expect(result).toBeNull();
    });
  });

  describe('incrementClick', () => {
    it('should increment clickCount and update lastClickedAt', async () => {
      (prismaMock.shortUrl.update as jest.Mock).mockResolvedValue({
        id: 'id-1',
        clickCount: 1,
        lastClickedAt: new Date(),
      });

      await service.incrementClick('id-1');

      expect(prismaMock.shortUrl.update).toHaveBeenCalledWith({
        where: { id: 'id-1' },
        data: {
          clickCount: { increment: 1 },
          lastClickedAt: expect.any(Date),
        },
      });
    });
  });
});
