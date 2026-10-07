/**
 * 409 for a mobile build create while a build of the same project and
 * platform is `queued` or `building`. `MobileBuildsService.create` throws
 * it after its row check, or when the live index
 * `mobile_builds_live_project_platform_uq` rejects the insert.
 */
import { ConflictException } from "@nestjs/common";

/** Thrown when a second live build tries to start for one project and platform. */
export class MobileBuildActiveError extends ConflictException {
	constructor() {
		super({
			code: "MOBILE_BUILD_ACTIVE",
			message: "A mobile build is already running for this project",
		});
	}
}
