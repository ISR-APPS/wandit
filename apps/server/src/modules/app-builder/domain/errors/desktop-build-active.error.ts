/**
 * 409 for a desktop build create while a build of the same project is live
 * (`queued`, `preparing`, `building`, or `signing`). `DesktopBuildsService.create`
 * throws it after its row check, or when the live index
 * `desktop_builds_live_project_uq` rejects the insert.
 */
import { ConflictException } from "@nestjs/common";

/** Thrown when a second live build tries to start for one project. */
export class DesktopBuildActiveError extends ConflictException {
	constructor() {
		super({
			code: "DESKTOP_BUILD_ACTIVE",
			message: "A desktop build is already running for this project",
		});
	}
}
