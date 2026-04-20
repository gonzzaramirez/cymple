import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { CurrentProfessionalId } from '../common/tenant/current-professional-id.decorator';
import { ListMessagesDto } from './dto/list-messages.dto';
import { GroupedMessagesDto } from './dto/grouped-messages.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('grouped')
  grouped(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: GroupedMessagesDto,
  ) {
    return this.messagesService.groupedByPatient(professionalId, query);
  }

  @Get()
  list(
    @CurrentProfessionalId() professionalId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.messagesService.list(professionalId, query);
  }

  @Get('stats')
  stats(@CurrentProfessionalId() professionalId: string) {
    return this.messagesService.countsByType(professionalId);
  }
}
