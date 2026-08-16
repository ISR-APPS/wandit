import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@wandit/db";
import { storyLinkClicks, storyLinks } from "@wandit/db/schema/story-links";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type StoryLinkRedirectTerms = {
	archivedAt: Date | null;
	destinationPath: string;
	id: string;
	utmCampaign: string;
	utmContent: string | null;
	utmMedium: string;
	utmSource: string;
};

@Injectable()
export class StoryLinkClickRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findBySlug(slug: string): Promise<StoryLinkRedirectTerms | null> {
		const [row] = await this.db
			.select({
				archivedAt: storyLinks.archivedAt,
				destinationPath: storyLinks.destinationPath,
				id: storyLinks.id,
				utmCampaign: storyLinks.utmCampaign,
				utmContent: storyLinks.utmContent,
				utmMedium: storyLinks.utmMedium,
				utmSource: storyLinks.utmSource,
			})
			.from(storyLinks)
			.where(eq(storyLinks.slug, slug))
			.limit(1);

		return row ?? null;
	}

	async insertClick(input: {
		ipHash: string;
		storyLinkId: string;
		userAgent: string | null;
	}): Promise<void> {
		await this.db.insert(storyLinkClicks).values(input);
	}
}
