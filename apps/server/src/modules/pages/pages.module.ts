import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { PageEditsService } from "./application/services/page-edits.service";
import { PagesService } from "./application/services/pages.service";
import { PagesRepository } from "./infrastructure/persistence/pages.repository";
import { PagesController } from "./presentation/http/controllers/pages.controller";

@Module({
	controllers: [PagesController],
	// PagesRepository is exported because the ai-chat module's generate_page
	// tool writes attempt rows through it at queue time; PageEditsService
	// because the chat agent's replace_section tool mutates versions through it.
	exports: [PageEditsService, PagesRepository, PagesService],
	imports: [DatabaseModule],
	providers: [PageEditsService, PagesRepository, PagesService],
})
export class PagesModule {}
