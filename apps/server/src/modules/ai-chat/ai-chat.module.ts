import { Module } from "@nestjs/common";

import { GenerationModule } from "../generation/generation.module";
import { LeadScrapesModule } from "../lead-scrapes/lead-scrapes.module";
import { MediaGenerationsModule } from "../media-generations/media-generations.module";
import { PagesModule } from "../pages/pages.module";
import { AiChatService } from "./application/services/ai-chat.service";
import { AiChatController } from "./presentation/http/controllers/ai-chat.controller";

@Module({
	controllers: [AiChatController],
	// GenerationModule exports ChatsRepository (persistence);
	// PagesModule exports PagesRepository (generate_page queue writes);
	// LeadScrapesModule exports LeadScrapesRepository (scrape_leads queue writes).
	imports: [
		GenerationModule,
		LeadScrapesModule,
		MediaGenerationsModule,
		PagesModule,
	],
	providers: [AiChatService],
})
export class AiChatModule {}
