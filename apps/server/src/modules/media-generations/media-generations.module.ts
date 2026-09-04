import { Module } from "@nestjs/common";

import { MeteringModule } from "../metering/metering.module";
import { VideoDirectorService } from "./application/services/video-director";

@Module({
	exports: [VideoDirectorService],
	imports: [MeteringModule],
	providers: [VideoDirectorService],
})
export class MediaGenerationsModule {}
