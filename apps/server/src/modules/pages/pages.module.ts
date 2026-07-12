import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { PagesService } from "./application/services/pages.service";
import { PagesRepository } from "./infrastructure/persistence/pages.repository";
import { PagesController } from "./presentation/http/controllers/pages.controller";

@Module({
	controllers: [PagesController],
	// PagesRepository is exported because the ai-chat module's generate_page
	// tool writes attempt rows through it at queue time.
	exports: [PagesRepository],
	imports: [DatabaseModule],
	providers: [PagesRepository, PagesService],
})
export class PagesModule {}
