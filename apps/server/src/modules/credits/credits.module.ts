import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditsService } from "./application/services/credits.service";
import { CreditsRepository } from "./infrastructure/persistence/credits.repository";
import { CreditsController } from "./presentation/http/controllers/credits.controller";

@Module({
	controllers: [CreditsController],
	exports: [CreditsService],
	imports: [DatabaseModule],
	providers: [CreditsRepository, CreditsService],
})
export class CreditsModule {}
