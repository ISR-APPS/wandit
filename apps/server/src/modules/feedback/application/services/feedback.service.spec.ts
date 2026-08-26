import type { AuthUser } from "@wandit/auth";
import type { CreateFeedbackRequest } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	CreatedLinearIssue,
	CreateIssueInput,
	LinearClient,
} from "../../infrastructure/linear/linear.client";
import type {
	FeedbackActivityInsert,
	FeedbackInsert,
	FeedbackRepository,
} from "../../infrastructure/persistence/feedback.repository";
import type { FeedbackScreenshotStore } from "../../infrastructure/storage/feedback-screenshot.store";
import { FeedbackService } from "./feedback.service";

const captureException = vi.hoisted(() => vi.fn());

vi.mock("@wandit/observability/nestjs", () => ({
	Sentry: { captureException },
}));

// Env is a mutable stub so each test controls exactly which keys exist.
const mockEnv = vi.hoisted(() => ({
	LINEAR_API_KEY: undefined as string | undefined,
	LINEAR_FEEDBACK_TEAM_ID: undefined as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

class FakeFeedbackRepository {
	readonly activities: FeedbackActivityInsert[] = [];
	readonly events: string[];
	readonly inserts: FeedbackInsert[] = [];
	readonly linearUpdates: Array<{
		feedbackId: string;
		issue: { issueId: string; url: string | null };
	}> = [];

	constructor(events: string[] = []) {
		this.events = events;
	}

	async insert(values: FeedbackInsert): Promise<void> {
		this.events.push("insert");
		this.inserts.push(values);
	}

	async insertActivity(values: FeedbackActivityInsert): Promise<void> {
		this.events.push("activity");
		this.activities.push(values);
	}

	async setLinearIssue(
		feedbackId: string,
		issue: { issueId: string; url: string | null },
	): Promise<void> {
		this.events.push("set-linear");
		this.linearUpdates.push({ feedbackId, issue });
	}
}

class FakeScreenshotStore {
	readonly stored: Array<{ feedbackId: string; dataUrl: string }> = [];
	url: string | null = null;

	async store(feedbackId: string, dataUrl: string): Promise<string | null> {
		this.stored.push({ feedbackId, dataUrl });
		return this.url;
	}
}

class FakeLinearClient {
	readonly events: string[];
	readonly issues: CreateIssueInput[] = [];
	readonly uploadedDataUrls: string[] = [];
	assetUrl: string | null = null;
	createIssueError: Error | null = null;
	labelError: Error | null = null;
	result: CreatedLinearIssue = {
		identifier: "ISRECOM-123",
		url: "https://linear.app/wandit/issue/ISRECOM-123",
	};

	constructor(events: string[] = []) {
		this.events = events;
	}

	async findOrCreateLabel(): Promise<string> {
		this.events.push("label");
		if (this.labelError) {
			throw this.labelError;
		}
		return "label-1";
	}

	async uploadScreenshot(dataUrl: string): Promise<string | null> {
		this.uploadedDataUrls.push(dataUrl);
		return this.assetUrl;
	}

	async createIssue(input: CreateIssueInput): Promise<CreatedLinearIssue> {
		this.events.push("issue");
		this.issues.push(input);
		if (this.createIssueError) {
			throw this.createIssueError;
		}
		return this.result;
	}
}

const user = {
	email: "sam@example.com",
	id: "user-1",
	name: "Sam",
} as AuthUser;

function setup(events: string[] = []) {
	const client = new FakeLinearClient(events);
	const repository = new FakeFeedbackRepository(events);
	const screenshotStore = new FakeScreenshotStore();
	const service = new FeedbackService(
		client as unknown as LinearClient,
		repository as unknown as FeedbackRepository,
		screenshotStore as unknown as FeedbackScreenshotStore,
	);

	return { client, repository, screenshotStore, service };
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
	vi.clearAllMocks();
	mockEnv.LINEAR_API_KEY = "lin_api_test";
	mockEnv.LINEAR_FEEDBACK_TEAM_ID = "team-1";
});

describe("FeedbackService.create", () => {
	it("stores feedback and returns null issueId when Linear is unconfigured", async () => {
		mockEnv.LINEAR_API_KEY = undefined;
		const { client, repository, service } = setup();

		const result = await service.create(user, makeRequest());

		expect(result.feedbackId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(result.issueId).toBeNull();
		expect(repository.inserts).toHaveLength(1);
		expect(repository.inserts[0]?.id).toBe(result.feedbackId);
		expect(repository.activities).toEqual([
			{ feedbackId: result.feedbackId, kind: "received" },
		]);
		expect(client.issues).toHaveLength(0);
	});

	it("stores the row and received activity before it mirrors to Linear", async () => {
		const events: string[] = [];
		const { repository, service } = setup(events);

		const result = await service.create(user, makeRequest());

		expect(events).toEqual([
			"insert",
			"activity",
			"label",
			"issue",
			"set-linear",
		]);
		expect(repository.linearUpdates).toEqual([
			{
				feedbackId: result.feedbackId,
				issue: {
					issueId: "ISRECOM-123",
					url: "https://linear.app/wandit/issue/ISRECOM-123",
				},
			},
		]);
		expect(result).toEqual({
			feedbackId: result.feedbackId,
			issueId: "ISRECOM-123",
		});
	});

	it("persists the request context and project id", async () => {
		const { repository, service } = setup();
		const projectId = "11111111-1111-4111-8111-111111111111";

		const result = await service.create(
			user,
			makeRequest({
				category: "bug",
				context: {
					locale: "en-US",
					userAgent: "Mozilla/5.0",
					viewport: { height: 800, width: 1280 },
				},
				pageUrl: `https://wandit.dev/p/${projectId}/editor`,
				replayUrl: "https://posthog.test/replay/1",
				sentryEventAt: "2026-08-25T12:00:00.000Z",
				sentryEventId: "event-1",
			}),
		);

		expect(repository.inserts[0]).toMatchObject({
			id: result.feedbackId,
			userId: "user-1",
			reporterName: "Sam",
			reporterEmail: "sam@example.com",
			projectId,
			category: "bug",
			replayUrl: "https://posthog.test/replay/1",
			sentryEventId: "event-1",
			sentryEventAt: new Date("2026-08-25T12:00:00.000Z"),
			userAgent: "Mozilla/5.0",
			viewportWidth: 1280,
			viewportHeight: 800,
			locale: "en-US",
		});
	});

	it("creates a labelled issue with the user context and feedback id", async () => {
		const { client, service } = setup();

		const result = await service.create(
			user,
			makeRequest({ replayUrl: "https://posthog.test/replay/1" }),
		);

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
		expect(issue?.description).toContain(
			`**Feedback id:** \`${result.feedbackId}\``,
		);
	});

	it("keeps the category title and description behavior", async () => {
		const { client, service } = setup();

		await service.create(user, makeRequest({ category: "bug" }));

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
		const { client, service } = setup();

		await service.create(user, makeRequest({ category: "idea" }));

		expect(client.issues[0]?.title).toBe(
			"Feedback (idea): The editor freezes when I drag a block",
		);
		expect(client.issues[0]?.description).toContain("**Category:** idea");
	});

	it("keeps the plain title and no category line without a category", async () => {
		const { client, service } = setup();

		await service.create(user, makeRequest());

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
		const { client, service } = setup();

		await service.create(
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
		const { client, service } = setup();

		await service.create(user, makeRequest({ sentryEventId: "abc123" }));

		const description = client.issues[0]?.description ?? "";
		expect(description).toContain(
			"**Last error (age unknown, maybe unrelated):** `abc123`",
		);
		expect(description).not.toContain("Recent error");
	});

	it("keeps a markdown image in the message inert", async () => {
		const { client, service } = setup();

		await service.create(
			user,
			makeRequest({ message: "hello ![x](https://evil.test/pixel.png) bye" }),
		);

		const description = client.issues[0]?.description ?? "";
		expect(description).toContain(
			"> hello \\!\\[x\\]\\(https://evil.test/pixel.png\\) bye",
		);
		expect(description).not.toContain("![x](https://evil.test/pixel.png)");
	});

	it("keeps a page URL with a newline on its own line", async () => {
		const { client, service } = setup();

		await service.create(
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
		const { client, service } = setup();

		await service.create(
			user,
			makeRequest({ pageUrl: "https://wandit.dev/projects/1?q=(a)" }),
		);

		expect(client.issues[0]?.description).toContain(
			"**Page URL:** <https://wandit.dev/projects/1?q=%28a%29>",
		);
	});

	it("shows a non-http replay URL as inert code", async () => {
		const { client, service } = setup();

		await service.create(
			user,
			makeRequest({ replayUrl: "javascript:alert(1)" }),
		);

		expect(client.issues[0]?.description).toContain(
			"**Session replay:** `javascript:alert(1)`",
		);
	});

	it("puts the browser context inside code spans", async () => {
		const { client, service } = setup();

		await service.create(
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

	it("stores the R2 URL and mirrors the Linear screenshot in parallel", async () => {
		const { client, repository, screenshotStore, service } = setup();
		const dataUrl = "data:image/png;base64,AAAA";
		screenshotStore.url = "https://assets.wandit.dev/feedback/shot.png";
		client.assetUrl = "https://uploads.linear.app/shot.png";

		const result = await service.create(
			user,
			makeRequest({ screenshot: { dataUrl } }),
		);

		expect(screenshotStore.stored).toEqual([
			{ feedbackId: result.feedbackId, dataUrl },
		]);
		expect(repository.inserts[0]?.screenshotUrl).toBe(
			"https://assets.wandit.dev/feedback/shot.png",
		);
		expect(client.uploadedDataUrls).toEqual([dataUrl]);
		expect(client.issues[0]?.description).toContain(
			"![Screenshot](https://uploads.linear.app/shot.png)",
		);
	});

	it("keeps the row and reports a Linear issue failure to Sentry", async () => {
		const { client, repository, service } = setup();
		const error = new Error("Linear is unavailable");
		client.createIssueError = error;

		const result = await service.create(user, makeRequest());

		expect(result.issueId).toBeNull();
		expect(repository.inserts).toHaveLength(1);
		expect(repository.linearUpdates).toHaveLength(0);
		expect(captureException).toHaveBeenCalledWith(error, {
			tags: { feature: "feedback" },
			extra: { feedbackId: result.feedbackId },
		});
	});

	it("also treats a Linear label failure as non-fatal", async () => {
		const { client, repository, service } = setup();
		const error = new Error("Label lookup failed");
		client.labelError = error;

		const result = await service.create(user, makeRequest());

		expect(result.issueId).toBeNull();
		expect(repository.inserts).toHaveLength(1);
		expect(client.issues).toHaveLength(0);
		expect(captureException).toHaveBeenCalledWith(error, {
			tags: { feature: "feedback" },
			extra: { feedbackId: result.feedbackId },
		});
	});
});
