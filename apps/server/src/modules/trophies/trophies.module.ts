/**
 * Nest module of the trophies: personal achievements that give points only, never credits.
 * AppModule imports it. It serves the routes under `/api/v1/trophies`.
 * It imports CreditsModule for the net spend of the personal wallet.
 */
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditsModule } from "../credits/credits.module";
import { TrophiesService } from "./application/services/trophies.service";
import { TrophiesRepository } from "./infrastructure/persistence/trophies.repository";
import { TrophiesController } from "./presentation/http/controllers/trophies.controller";

@Module({
	controllers: [TrophiesController],
	imports: [CreditsModule, DatabaseModule],
	providers: [TrophiesRepository, TrophiesService],
})
export class TrophiesModule {}
