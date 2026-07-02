import { Module } from "@nestjs/common";

import { HealthController } from "./presentation/http/controllers/health.controller";

@Module({
	controllers: [HealthController],
})
export class HealthModule {}
