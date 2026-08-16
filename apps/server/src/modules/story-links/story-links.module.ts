import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AdminSecurityModule } from "../admin/admin-security.module";
import { AffiliateTokenService } from "../affiliates/application/services/affiliate-token.service";
import { AttributionModule } from "../attribution/attribution.module";
import { StoryLinkAdminService } from "./application/services/story-link-admin.service";
import { StoryLinkClickThrottle } from "./application/services/story-link-click-throttle";
import { StoryLinkRedirectService } from "./application/services/story-link-redirect.service";
import { StoryLinkAdminRepository } from "./infrastructure/persistence/story-link-admin.repository";
import { StoryLinkClickRepository } from "./infrastructure/persistence/story-link-click.repository";
import { StoryLinkAdminController } from "./presentation/http/controllers/story-link-admin.controller";
import { StoryLinkRedirectController } from "./presentation/http/controllers/story-link-redirect.controller";

@Module({
	controllers: [StoryLinkAdminController, StoryLinkRedirectController],
	imports: [AdminSecurityModule, AttributionModule, DatabaseModule],
	providers: [
		AffiliateTokenService,
		StoryLinkAdminRepository,
		StoryLinkAdminService,
		StoryLinkClickRepository,
		StoryLinkClickThrottle,
		StoryLinkRedirectService,
	],
})
export class StoryLinksModule {}
