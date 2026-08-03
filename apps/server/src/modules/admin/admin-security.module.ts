import { Module } from "@nestjs/common";

import { AdminGuard } from "./presentation/http/guards/admin.guard";

@Module({
	exports: [AdminGuard],
	providers: [AdminGuard],
})
export class AdminSecurityModule {}
