/**
 * 409 for a user write or delete of a `system` project secret.
 * `ProjectSecretsService` throws it; the API exception filter renders it
 * as the `PROJECT_SECRET_SYSTEM` envelope the Secrets panel reads.
 */
import { ConflictException } from "@nestjs/common";

/** Stable machine code the client reads to show the locked-row copy. */
export const PROJECT_SECRET_SYSTEM_ERROR_CODE = "PROJECT_SECRET_SYSTEM";

/** Thrown when a user tries to replace or delete a `system` secret. */
export class ProjectSecretSystemError extends ConflictException {
	constructor(name: string) {
		super({
			code: PROJECT_SECRET_SYSTEM_ERROR_CODE,
			message: `${name} is a system secret and cannot be changed by a user`,
		});
	}
}
