import { ServiceUnavailableException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { CreateFeedbackRequest } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	CreateIssueInput,
	LinearClient,
} from "../../infrastructure/linear/linear.client";
import { FeedbackService } from "./feedback.service";

// Env is a mutable stub so each test controls exactly which keys exist.
const mockEnv = vi.hoisted(() => ({
	LINEAR_API_KEY: undefined as string | undefined,
	LINEAR_FEEDBACK_TEAM_ID: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

class FakeLinearClient {
	readonly issues: CreateIssueInput[] = [];
	readonly uploadedDataUrls: string[] = [];
	assetUrl: string | null = null;

	async findOrCreateLabel(): Promise<string> {
		return "label-1";
	}

	async uploadScreenshot(dataUrl: string): Promise<string | null> {
		this.uploadedDataUrls.push(dataUrl);
		return this.assetUrl;
	}

	async createIssue(input: CreateIssueInput): Promise<string> {
		this.issues.push(input);
		return "ISRECOM-123";
	}
}

const user = {
	email: "sam@example.com",
	id: "user-1",
	name: "Sam",
} as AuthUser;

function makeService(client: FakeLinearClient) {
	return new FeedbackService(client as unknown as LinearClient);
}

function makeRequest(
	overrides: Partial<CreateFeedbackRequest> = {},
): CreateFeedbackRequest {
	return {
		message: "The editor freezes when I drag a block",
		pageUrl: "https://wandit.dev/projects/1",
		...overrides,
	};
}

beforeEach(() => {
	mockEnv.LINEAR_API_KEY = "lin_api_test";
	mockEnv.LINEAR_FEEDBACK_TEAM_ID = "team-1";
});

describe("FeedbackService.create", () => {
	it("answers 503 when Linear is unconfigured", async () => {
		mockEnv.LINEAR_API_KEY = undefined;
		const client = new FakeLinearClient();

		await expect(
			makeService(client).create(user, makeRequest()),
		).rejects.toThrow(ServiceUnavailableException);
		expect(client.issues).toHaveLength(0);
	});

	it("creates a labelled issue with the user context", async () => {
		const client = new FakeLinearClient();

		const result = await makeService(client).create(
			user,
			makeRequest({ replayUrl: "https://posthog.test/replay/1" }),
		);

		expect(result).toEqual({ issueId: "ISRECOM-123" });
		const issue = client.issues[0];
		expect(issue?.labelIds).toEqual(["label-1"]);
		expect(issue?.teamId).toBe("team-1");
		expect(issue?.title).toBe(
			"Feedback: The editor freezes when I drag a block",
		);
		expect(issue?.description).toContain(
			"> The editor freezes when I drag a block",
		);
		expect(issue?.description).toContain("sam@example.com");
		expect(issue?.description).toContain("https://posthog.test/replay/1");
	});

	it("puts the category in the title and above the user line", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(user, makeRequest({ category: "bug" }));

		const issue = client.issues[0];
		expect(issue?.title).toBe(
			"Feedback (bug): The editor freezes when I drag a block",
		);

		const lines = (issue?.description ?? "").split("\n");
		const categoryIndex = lines.indexOf("**Category:** bug");
		const userIndex = lines.findIndex((line) => line.startsWith("**User:**"));

		expect(categoryIndex).toBeGreaterThan(-1);
		expect(userIndex).toBe(categoryIndex + 1);
	});

	it("uses the chosen category word in the title", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(user, makeRequest({ category: "idea" }));

		expect(client.issues[0]?.title).toBe(
			"Feedback (idea): The editor freezes when I drag a block",
		);
		expect(client.issues[0]?.description).toContain("**Category:** idea");
	});

	it("keeps the plain title and no category line without a category", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(user, makeRequest());

		const issue = client.issues[0];
		expect(issue?.title).toBe(
			"Feedback: The editor freezes when I drag a block",
		);
		expect(issue?.description).not.toContain("**Category:**");

		const lines = (issue?.description ?? "").split("\n");
		const userIndex = lines.findIndex((line) => line.startsWith("**User:**"));

		expect(lines[userIndex - 1]).toBe("");
	});

	it("marks an old Sentry error as maybe unrelated", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(
			user,
			makeRequest({
				sentryEventAt: new Date(Date.now() - 10 * 60_000).toISOString(),
				sentryEventId: "abc123",
			}),
		);

		expect(client.issues[0]?.description).toContain(
			"min before submit, maybe unrelated",
		);
	});

	it("says the age is unknown when Sentry sends no timestamp", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(
			user,
			makeRequest({ sentryEventId: "abc123" }),
		);

		const description = client.issues[0]?.description ?? "";
		expect(description).toContain(
			"**Last error (age unknown, maybe unrelated):** `abc123`",
		);
		expect(description).not.toContain("Recent error");
	});

	it("keeps a markdown image in the message inert", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(
			user,
			makeRequest({
				message: "hello ![x](https://evil.test/pixel.png) bye",
			}),
		);

		const description = client.issues[0]?.description ?? "";
		expect(description).toContain(
			"> hello \\!\\[x\\]\\(https://evil.test/pixel.png\\) bye",
		);
		expect(description).not.toContain("![x](https://evil.test/pixel.png)");
	});

	it("keeps a page URL with a newline on its own line", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(
			user,
			makeRequest({
				pageUrl: "https://wandit.dev/a\n## Fake section\n**User:** admin",
			}),
		);

		const description = client.issues[0]?.description ?? "";
		const pageLine = description
			.split("\n")
			.find((line) => line.startsWith("**Page URL:**"));

		expect(pageLine).toBe(
			"**Page URL:** <https://wandit.dev/a##%20Fake%20section**User:**%20admin>",
		);
		expect(description).not.toContain("\n## Fake section");
	});

	it("renders a valid page URL as an inert autolink", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(
			user,
			makeRequest({ pageUrl: "https://wandit.dev/projects/1?q=(a)" }),
		);

		expect(client.issues[0]?.description).toContain(
			"**Page URL:** <https://wandit.dev/projects/1?q=%28a%29>",
		);
	});

	it("shows a non-http replay URL as inert code", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(
			user,
			makeRequest({ replayUrl: "javascript:alert(1)" }),
		);

		expect(client.issues[0]?.description).toContain(
			"**Session replay:** `javascript:alert(1)`",
		);
	});

	it("puts the browser context inside code spans", async () => {
		const client = new FakeLinearClient();

		await makeService(client).create(
			user,
			makeRequest({
				context: {
					locale: "en-US",
					userAgent: "Mozilla/5.0 `whoami`",
					viewport: { height: 800, width: 1280 },
				},
			}),
		);

		expect(client.issues[0]?.description).toContain(
			"**Browser:** `Mozilla/5.0 whoami` — 1280x800 — `en-US`",
		);
	});

	it("embeds the screenshot only when the upload succeeds", async () => {
		const failing = new FakeLinearClient();
		const request = makeRequest({
			screenshot: { dataUrl: "data:image/png;base64,AAAA" },
		});

		await makeService(failing).create(user, request);

		expect(failing.uploadedDataUrls).toHaveLength(1);
		expect(failing.issues[0]?.description).not.toContain("![Screenshot]");

		const working = new FakeLinearClient();
		working.assetUrl = "https://uploads.linear.app/shot.png";

		await makeService(working).create(user, request);

		expect(working.issues[0]?.description).toContain(
			"![Screenshot](https://uploads.linear.app/shot.png)",
		);
	});
});
