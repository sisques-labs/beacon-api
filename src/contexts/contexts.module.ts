import { DynamicModule, Module, Type } from '@nestjs/common';

import { ClientsModule } from '@contexts/clients/clients.module';
import { NotificationsModule } from '@contexts/notifications/notifications.module';

// Register every bounded context module here as it's added.
const CONTEXT_MODULES: (DynamicModule | Type<unknown>)[] = [
  ClientsModule,
  NotificationsModule,
];

@Module({
  imports: [...CONTEXT_MODULES],
})
export class ContextsModule {}
