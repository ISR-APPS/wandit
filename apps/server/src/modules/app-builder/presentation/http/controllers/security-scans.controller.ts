/**
 * `/api/v2/projects/:projectId/security-scans`: the stored security scan
 * reports of one V2 app. The Security panel of the builder reads the latest
 * one. The global AuthGuard needs a session, the global ProjectAccessGuard
 * checks the project role (404 on a project the caller cannot see), and
 * `V2BuilderEnabledGuard` gates the module. It reads `SecurityScansRepository`.
 */
import {
	Controller,
	Get,
	Inject,
	Logger,
	Param,
	UseGuards,
} from "@nestjs/common";
import {
	type LatestSecurityScanResponse,
	securityScanReportSchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { RequireProjectRole } from "../../../../projects";
import { SecurityScansRepository } from "../../../infrastructure/persistence/security-scans.repository";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/** The security scan routes of the V2 app builder. */
@Controller("v2/projects/:projectId/security-scans")
@UseGuards(V2BuilderEnabledGuard)
export class SecurityScansController {
	private readonly logger = new Logger(SecurityScansController.name);

	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(SecurityScansRepository)
		private readonly scans: Pick<SecurityScansRepository, "findLatest">,
	) {}

	// Editors only: the findings name the weak spots of the app.
	@RequireProjectRole("editor")
	@Get("latest")
	async latest(
		@Param("projectId", new ZodValidationPipe(uuidSchema)) projectId: string,
	): Promise<LatestSecurityScanResponse> {
		const row = await this.scans.findLatest(projectId);
		if (row === null) {
			return { scan: null };
		}
		const report = securityScanReportSchema.safeParse(row.report);
		// A row that fails the parse (an older report shape) answers no scan,
		// not a 500: the panel then offers a new scan. The log keeps the row id.
		if (!report.success) {
			this.logger.error(
				`Security scan ${row.id} of project ${projectId} failed the report parse: ${report.error.message}`,
			);
			return { scan: null };
		}
		return {
			scan: {
				createdAt: row.createdAt.toISOString(),
				id: row.id,
				report: report.data,
				turnId: row.turnId,
			},
		};
	}
}
