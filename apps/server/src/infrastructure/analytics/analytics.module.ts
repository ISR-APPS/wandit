import { Global, Module } from "@nestjs/common";

import { AnalyticsService } from "./analytics.service";

@Global()
@Module({
	exports: [AnalyticsService],
	providers: [AnalyticsService],
})
export class AnalyticsModule {}
