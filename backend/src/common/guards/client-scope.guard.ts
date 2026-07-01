import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ClientScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.clientId = req.user?.clientId;
    return !!req.clientId;
  }
}
