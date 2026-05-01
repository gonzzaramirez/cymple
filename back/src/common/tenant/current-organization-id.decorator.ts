import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentOrganizationId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationId as string;
  },
);
