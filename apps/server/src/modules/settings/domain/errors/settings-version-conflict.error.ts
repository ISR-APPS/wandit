import { ConflictException } from "@nestjs/common";

export const SETTINGS_VERSION_CONFLICT_ERROR_CODE = "SETTINGS_VERSION_CONFLICT";

export class SettingsVersionConflictError extends ConflictException {
	constructor() {
		super({
			code: SETTINGS_VERSION_CONFLICT_ERROR_CODE,
			message: "Product settings changed; refresh and retry",
		});
	}
}
