import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminProjectVersionHtmlResponse } from "@wandit/contracts";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import { stampHtml } from "../../../pages/domain/stamp";
import { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { AdminRepository } from "../../infrastructure/persistence/admin.repository";

@Injectable()
export class AdminPagePreviewService {
	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
		@Inject(PagesRepository)
		private readonly pagesRepository: PagesRepository,
	) {}

	async versionHtml(
		projectId: string,
		versionId: string,
	): Promise<AdminProjectVersionHtmlResponse> {
		const project = await this.adminRepository.findProjectDetail(projectId);

		if (!project) {
			throw new NotFoundException();
		}

		const scope: ProjectScope = project.organizationId
			? {
					actorIsLimitExempt: true,
					kind: "org",
					organizationId: project.organizationId,
					userId: project.ownerId,
				}
			: { kind: "personal", userId: project.ownerId };
		const version = await this.pagesRepository.findAccessibleVersionById(
			scope,
			versionId,
		);

		// Scope alone is insufficient: one owner can have many projects. The URL's
		// project id must match the immutable version row exactly.
		if (!version || version.projectId !== projectId) {
			throw new NotFoundException();
		}

		const html = await getPageHtml(version.r2Key);

		if (html === null) {
			throw new NotFoundException();
		}

		return { html: stampHtml(html) };
	}
}
