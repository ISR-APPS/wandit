import { Module } from "@nestjs/common";

import { SupportService } from "./application/services/support.service";
import { SupportController } from "./presentation/http/controllers/support.controller";

// Live-chat support: hands the widget a server-signed identity for the
// signed-in user (Chatwoot identity validation).
@Module({
	controllers: [SupportController],
	providers: [SupportService],
})
export class SupportModule {}
