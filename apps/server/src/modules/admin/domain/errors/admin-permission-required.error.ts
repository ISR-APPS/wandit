import { ForbiddenException } from "@nestjs/common";
import { ADMIN_PERMISSION_REQUIRED_ERROR_CODE } from "@wandit/contracts";

export class AdminPermissionRequiredError extends ForbiddenException {
	constructor() {
		super({
			code: ADMIN_PERMISSION_REQUIRED_ERROR_CODE,
			message: "This account does not have permission for this action.",
		});
	}
}
