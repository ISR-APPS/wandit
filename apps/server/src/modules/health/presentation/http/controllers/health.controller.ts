import { Controller, Get } from "@nestjs/common";

import { Public } from "../../../../auth";

@Public()
@Controller()
export class HealthController {
	@Get()
	root() {
		return { status: "ok" };
	}

	@Get("health")
	health() {
		return {
			service: "api",
			status: "ok",
		};
	}
}
