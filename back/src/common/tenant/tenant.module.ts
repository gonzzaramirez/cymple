import { Global, Module } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { TenantResolverService } from './tenant-resolver.service';

@Global()
@Module({
  providers: [TenantResolverService, TenantGuard],
  exports: [TenantResolverService, TenantGuard],
})
export class TenantModule {}
