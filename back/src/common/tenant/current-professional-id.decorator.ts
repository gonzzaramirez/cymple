import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentProfessionalId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.professionalId as string;
  },
);
