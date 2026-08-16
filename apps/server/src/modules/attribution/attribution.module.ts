import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { UtmAttributionService } from "./application/services/utm-attribution.service";
import { UtmAttributionThrottle } from "./application/services/utm-attribution-throttle";
import { UtmAttributionTokenService } from "./application/services/utm-attribution-token.service";
import { UserAttributionRepository } from "./infrastructure/persistence/user-attribution.repository";
import { UtmAttributionController } from "./presentation/http/controllers/utm-attribution.controller";

@Module({
	controllers: [UtmAttributionController],
	exports: [UtmAttributionService, UtmAttributionTokenService],
	imports: [DatabaseModule],
	providers: [
		UserAttributionRepository,
		UtmAttributionService,
		UtmAttributionThrottle,
		UtmAttributionTokenService,
	],
})
export class AttributionModule {}
