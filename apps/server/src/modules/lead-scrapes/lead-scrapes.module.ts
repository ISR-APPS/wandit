import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { LeadScrapesService } from "./application/services/lead-scrapes.service";
import { LeadScrapesRepository } from "./infrastructure/persistence/lead-scrapes.repository";
import { LeadScrapesController } from "./presentation/http/controllers/lead-scrapes.controller";

@Module({
	controllers: [LeadScrapesController],
	// LeadScrapesRepository is exported because the ai-chat module's
	// scrape_leads tool writes attempt rows through it at queue time.
	exports: [LeadScrapesRepository, LeadScrapesService],
	imports: [DatabaseModule],
	providers: [LeadScrapesRepository, LeadScrapesService],
})
export class LeadScrapesModule {}
