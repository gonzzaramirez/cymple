import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

describe('ShortUrl (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.shortUrl.deleteMany({
      where: { code: { startsWith: 'test-' } },
    });
    await app.close();
  });

  it('GET /v1/public/short-urls/:code returns the original URL (happy path)', async () => {
    // Seed a short URL via Prisma directly
    const code = 'test-1';
    const originalUrl = 'https://example.com/very-long-path';
    await prisma.shortUrl.create({
      data: {
        code,
        originalUrl,
        clickCount: 0,
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/public/short-urls/${code}`)
      .expect(200);

    expect(response.body).toMatchObject({
      originalUrl,
    });
  });

  it('GET /v1/public/short-urls/:code returns 404 for unknown code', async () => {
    await request(app.getHttpServer())
      .get('/v1/public/short-urls/ZZZZZZ')
      .expect(404);
  });

  it('GET /v1/public/short-urls/:code increments click count on resolution', async () => {
    const code = 'test-2';
    const originalUrl = 'https://example.com/click-test';
    await prisma.shortUrl.create({
      data: {
        code,
        originalUrl,
        clickCount: 0,
      },
    });

    // First request — resolves and increments
    const response = await request(app.getHttpServer())
      .get(`/v1/public/short-urls/${code}`)
      .expect(200);

    expect(response.body.originalUrl).toBe(originalUrl);

    // Verify clickCount was incremented in DB
    const record = await prisma.shortUrl.findUnique({
      where: { code },
      select: { clickCount: true, lastClickedAt: true },
    });

    expect(record?.clickCount).toBe(1);
    expect(record?.lastClickedAt).toBeTruthy();
  });
});
