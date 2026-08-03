import { ForbiddenException } from "@nestjs/common";

export const ORGANIZATIONS_DISABLED_ERROR_CODE = "ORGANIZATIONS_DISABLED";

export class OrganizationsDisabledError extends ForbiddenException {
	constructor() {
		super({
			code: ORGANIZATIONS_DISABLED_ERROR_CODE,
			message: "Workspaces are disabled",
		});
	}
}
