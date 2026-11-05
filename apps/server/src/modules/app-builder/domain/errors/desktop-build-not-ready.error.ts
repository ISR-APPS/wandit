/**
 * 409 for a desktop release of a build that is not `ready`.
 * `DesktopBuildsService.release` throws it before it writes the updater
 * manifest, so installed apps never see an unsigned or failed build.
 */
import { ConflictException } from "@nestjs/common";

/** Thrown when the release route gets a build that has no signed installer. */
export class DesktopBuildNotReadyError extends ConflictException {
	constructor() {
		super({
			code: "DESKTOP_BUILD_NOT_READY",
			message: "Only a ready desktop build can be released",
		});
	}
}
