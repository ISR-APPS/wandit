import { Module } from "@nestjs/common";

import { ConnectorGenerationsModule } from "../connector-generations/connector-generations.module";
import { GenerationModule } from "../generation/generation.module";
import { ImageGenerationsModule } from "../image-generations/image-generations.module";
import { LeadScrapesModule } from "../lead-scrapes/lead-scrapes.module";
import { MarketingAssetsModule } from "../marketing-assets/marketing-assets.module";
import { McpConnectorsModule } from "../mcp-connectors/mcp-connectors.module";
import { MediaGenerationsModule } from "../media-generations/media-generations.module";
import { MeteringModule } from "../metering/metering.module";
import { PagesModule } from "../pages/pages.module";
import { AiChatService } from "./application/services/ai-chat.service";
import { AiChatController } from "./presentation/http/controllers/ai-chat.controller";

@Module({
	controllers: [AiChatController],
	// GenerationModule exports ChatsRepository (persistence);
	// PagesModule exports PagesRepository (generate_page queue writes);
	// LeadScrapesModule exports LeadScrapesRepository (scrape_leads queue writes);
	// MarketingAssetsModule / ImageGenerationsModule export the repositories
	// behind generate_marketing_asset and generate_image.
	imports: [
		ConnectorGenerationsModule,
		GenerationModule,
		ImageGenerationsModule,
		LeadScrapesModule,
		MarketingAssetsModule,
		MeteringModule,
		McpConnectorsModule,
		MediaGenerationsModule,
		PagesModule,
	],
	providers: [AiChatService],
})
export class AiChatModule {}
