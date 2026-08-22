import { ConflictException } from "@nestjs/common";

export const MANUAL_PAYMENTS_DISABLED_ERROR_CODE = "MANUAL_PAYMENTS_DISABLED";

export class ManualPaymentsDisabledError extends ConflictException {
	constructor() {
		super({
			code: MANUAL_PAYMENTS_DISABLED_ERROR_CODE,
			message: "Offline payments are disabled",
		});
	}
}
