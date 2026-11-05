/**
 * 503 for a desktop project create while the server has no desktop template.
 * `TemplateVersionService.versionFor("desktop")` throws it when
 * `templates/desktop-app/template_version` was absent at boot. The API
 * exception filter renders it as the `DESKTOP_TEMPLATE_UNAVAILABLE` envelope.
 */
import { ServiceUnavailableException } from "@nestjs/common";

/** Thrown before any row exists, so a failed desktop create writes nothing. */
export class DesktopTemplateUnavailableError extends ServiceUnavailableException {
	constructor() {
		super({
			code: "DESKTOP_TEMPLATE_UNAVAILABLE",
			message: "The desktop app template is not available on this server",
		});
	}
}
