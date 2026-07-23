import { Module } from "@nestjs/common";

import { UploadsService } from "./application/services/uploads.service";
import { UploadsController } from "./presentation/http/controllers/uploads.controller";

@Module({
	controllers: [UploadsController],
	providers: [UploadsService],
})
export class UploadsModule {}
