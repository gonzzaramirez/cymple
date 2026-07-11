import { Module } from '@nestjs/common';
import { ShortUrlController, PublicShortUrlController } from './short-url.controller';
import { ShortUrlService } from './short-url.service';

@Module({
  controllers: [ShortUrlController, PublicShortUrlController],
  providers: [ShortUrlService],
  exports: [ShortUrlService],
})
export class ShortUrlModule {}
