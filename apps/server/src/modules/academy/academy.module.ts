import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AdminSecurityModule } from "../admin/admin-security.module";
import { AcademyService } from "./application/services/academy.service";
import { AcademyRepository } from "./infrastructure/persistence/academy.repository";
import { AcademyController } from "./presentation/http/controllers/academy.controller";
import { AcademyAdminController } from "./presentation/http/controllers/academy-admin.controller";

@Module({
	controllers: [AcademyAdminController, AcademyController],
	imports: [AdminSecurityModule, DatabaseModule],
	providers: [AcademyRepository, AcademyService],
})
export class AcademyModule {}
