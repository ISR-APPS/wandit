/**
 * 503 for a mobile project create while the server has no mobile template.
 * `TemplateVersionService.versionFor("mobile")` throws it when
 * `templates/mobile-app/template_version` was absent at boot. The API
 * exception filter renders it as the `MOBILE_TEMPLATE_UNAVAILABLE` envelope.
 */
import { ServiceUnavailableException } from "@nestjs/common";

/** Thrown before any row exists, so a failed mobile create writes nothing. */
export class MobileTemplateUnavailableError extends ServiceUnavailableException {
	constructor() {
		super({
			code: "MOBILE_TEMPLATE_UNAVAILABLE",
			message: "The mobile app template is not available on this server",
		});
	}
}
