import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { buildAccessContext } from '../common/tenant/access-context';
import { ListMessagesDto } from './dto/list-messages.dto';
import { GroupedMessagesDto } from './dto/grouped-messages.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('grouped')
  grouped(@Req() req: Request, @Query() query: GroupedMessagesDto) {
    return this.messagesService.groupedByPatient(
      buildAccessContext(req),
      query,
    );
  }

  @Get()
  list(@Req() req: Request, @Query() query: ListMessagesDto) {
    return this.messagesService.list(buildAccessContext(req), query);
  }

  @Get('stats')
  stats(@Req() req: Request) {
    return this.messagesService.countsByType(buildAccessContext(req));
  }
}
