import { userAttributions } from "@wandit/db/schema/user-attributions";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type InsertUserAttribution,
	UserAttributionRepository,
} from "./user-attribution.repository";

const INPUT: InsertUserAttribution = {
	country: "US",
	device: "mobile",
	landingPath: "/pricing",
	referrer: "https://www.google.com/",
	source: "cookie",
	storyLinkSlug: "summer-story",
	userId: "user_1",
	utmCampaign: "summer-launch",
	utmContent: "hero-cta",
	utmMedium: "cpc",
	utmSource: "google",
};

function setup(rows: unknown[]) {
	const returning = vi.fn(async () => rows);
	const onConflictDoNothing = vi.fn(() => ({ returning }));
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));
	const repository = new UserAttributionRepository({
		insert,
	} as unknown as Database);

	return { insert, onConflictDoNothing, repository, values };
}

describe("UserAttributionRepository", () => {
	it("persists the classified device with the first-wins attribution row", async () => {
		const row = {
			...INPUT,
			createdAt: new Date("2026-08-15T12:00:00.000Z"),
			id: "11111111-1111-4111-8111-111111111111",
			updatedAt: new Date("2026-08-15T12:00:00.000Z"),
		};
		const { insert, onConflictDoNothing, repository, values } = setup([row]);

		await expect(repository.insertFirstWins(INPUT)).resolves.toEqual(row);
		expect(insert).toHaveBeenCalledWith(userAttributions);
		expect(values).toHaveBeenCalledWith(INPUT);
		expect(onConflictDoNothing).toHaveBeenCalledWith({
			target: userAttributions.userId,
		});
	});

	it("returns null when the user already has immutable attribution", async () => {
		const { repository } = setup([]);

		await expect(repository.insertFirstWins(INPUT)).resolves.toBeNull();
	});
});
