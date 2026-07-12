import { Module } from "@nestjs/common";

import { GenerationModule } from "../generation/generation.module";
import { PagesModule } from "../pages/pages.module";
import { AiChatService } from "./application/services/ai-chat.service";
import { AiChatController } from "./presentation/http/controllers/ai-chat.controller";

@Module({
	controllers: [AiChatController],
	// GenerationModule exports ChatsRepository (persistence);
	// PagesModule exports PagesRepository (generate_page queue writes).
	imports: [GenerationModule, PagesModule],
	providers: [AiChatService],
})
export class AiChatModule {}
