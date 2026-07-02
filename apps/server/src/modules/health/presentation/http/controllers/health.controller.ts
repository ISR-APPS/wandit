import { Controller, Get } from "@nestjs/common";

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
