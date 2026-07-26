import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditsModule } from "../credits/credits.module";
import { AdminStatsService } from "./application/services/admin-stats.service";
import { AdminUsersService } from "./application/services/admin-users.service";
import { AdminRepository } from "./infrastructure/persistence/admin.repository";
import { AdminStatsController } from "./presentation/http/controllers/admin-stats.controller";
import { AdminUsersController } from "./presentation/http/controllers/admin-users.controller";
import { AdminGuard } from "./presentation/http/guards/admin.guard";

@Module({
	controllers: [AdminUsersController, AdminStatsController],
	imports: [CreditsModule, DatabaseModule],
	providers: [
		AdminGuard,
		AdminRepository,
		AdminStatsService,
		AdminUsersService,
	],
})
export class AdminModule {}
