import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { PushTokensRepository } from "./infrastructure/persistence/push-tokens.repository";
import { LeadPushDispatcherService } from "./infrastructure/trigger/lead-push-dispatcher.service";
import { PushTokensController } from "./presentation/http/controllers/push-tokens.controller";

@Module({
	controllers: [PushTokensController],
	exports: [LeadPushDispatcherService],
	imports: [DatabaseModule],
	providers: [LeadPushDispatcherService, PushTokensRepository],
})
export class PushNotificationsModule {}
