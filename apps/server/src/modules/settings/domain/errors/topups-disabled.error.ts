import { ForbiddenException } from "@nestjs/common";

export const TOPUPS_DISABLED_ERROR_CODE = "TOPUPS_DISABLED";

export class TopupsDisabledError extends ForbiddenException {
	constructor() {
		super({
			code: TOPUPS_DISABLED_ERROR_CODE,
			message: "Credit top-ups are disabled",
		});
	}
}
