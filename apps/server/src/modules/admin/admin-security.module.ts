import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AdminViewGrantsRepository } from "./infrastructure/persistence/admin-view-grants.repository";
import { AdminGuard } from "./presentation/http/guards/admin.guard";

@Module({
	exports: [AdminGuard, AdminViewGrantsRepository],
	imports: [DatabaseModule],
	providers: [AdminGuard, AdminViewGrantsRepository],
})
export class AdminSecurityModule {}
