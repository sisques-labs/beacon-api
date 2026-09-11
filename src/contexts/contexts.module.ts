import { DynamicModule, Module, Type } from '@nestjs/common';

import { NotificationsModule } from '@contexts/notifications/notifications.module';

// Register every bounded context module here as it's added.
const CONTEXT_MODULES: (DynamicModule | Type<unknown>)[] = [
  NotificationsModule,
];

@Module({
  imports: [...CONTEXT_MODULES],
})
export class ContextsModule {}
