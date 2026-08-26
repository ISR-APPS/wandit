import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type {
	CreateFeedbackRequest,
	CreateFeedbackResponse,
	FeedbackCategory,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/nestjs";

import { projectIdFromPageUrl } from "../../domain/feedback-page-url";
import { feedbackTitle } from "../../domain/feedback-title";
import {
	FEEDBACK_LABEL_NAME,
	SENTRY_RECENT_ERROR_MS,
} from "../../feedback.constants";
import { LinearClient } from "../../infrastructure/linear/linear.client";
import { FeedbackRepository } from "../../infrastructure/persistence/feedback.repository";
import { FeedbackScreenshotStore } from "../../infrastructure/storage/feedback-screenshot.store";

// Characters that start markdown syntax. Linear renders the description as
// markdown, so user text must not be able to inject images, links, or headings.
const MARKDOWN_ACTIVE_CHARACTERS = /[[\]()!`*_~#]/g;

// Newlines plus C0/C1 control characters. These break a value out of its line.
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * Escapes markdown syntax in text the user typed.
 *
 * The text keeps its meaning for a human reader, but Linear shows it literally.
 */
function escapeMarkdown(value: string): string {
	return value.replace(MARKDOWN_ACTIVE_CHARACTERS, (character) => {
		return `\\${character}`;
	});
}

/**
 * Makes a one-line inline code span from user text.
 *
 * Control characters and backticks go away, so the span cannot close early or
 * add lines of its own.
 */
function codeSpan(value: string): string {
	const oneLine = value.replace(CONTROL_CHARACTERS, " ").replace(/`/g, "");

	return `\`${oneLine.trim()}\``;
}

/**
 * Renders a user-supplied URL.
 *
 * Only http and https links become markdown autolinks. Anything else, for
 * example `javascript:` or a value with a fake markdown section in it, shows as
 * inline code and stays inert.
 */
function renderUrl(value: string): string {
	const cleaned = value.replace(CONTROL_CHARACTERS, "").trim();

	let parsed: URL;

	try {
		parsed = new URL(cleaned);
	} catch {
		return codeSpan(value);
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return codeSpan(value);
	}

	// `href` percent-encodes spaces and other characters that would end the
	// autolink early. The URL parser keeps parentheses, so they go next.
	const encoded = parsed.href.replace(/\(/g, "%28").replace(/\)/g, "%29");

	return `<${encoded}>`;
}

@Injectable()
export class FeedbackService {
	private readonly logger = new Logger(FeedbackService.name);

	constructor(
		@Inject(LinearClient)
		private readonly linearClient: LinearClient,
		@Inject(FeedbackRepository)
		private readonly repository: FeedbackRepository,
		@Inject(FeedbackScreenshotStore)
		private readonly screenshotStore: FeedbackScreenshotStore,
	) {}

	async create(
		user: AuthUser,
		request: CreateFeedbackRequest,
	): Promise<CreateFeedbackResponse> {
		const feedbackId = randomUUID();
		const submittedAt = new Date();
		const teamId = env.LINEAR_FEEDBACK_TEAM_ID;
		const linearReady = Boolean(env.LINEAR_API_KEY && teamId);
		const [screenshotUrl, linearAssetUrl] = await Promise.all([
			request.screenshot
				? this.screenshotStore.store(feedbackId, request.screenshot.dataUrl)
				: null,
			linearReady && request.screenshot
				? this.linearClient.uploadScreenshot(request.screenshot.dataUrl)
				: null,
		]);

		await this.repository.insert({
			id: feedbackId,
			userId: user.id,
			reporterName: user.name || "Unknown",
			reporterEmail: user.email,
			projectId: projectIdFromPageUrl(request.pageUrl),
			category: request.category ?? null,
			message: request.message,
			pageUrl: request.pageUrl,
			replayUrl: request.replayUrl ?? null,
			sentryEventId: request.sentryEventId ?? null,
			sentryEventAt: request.sentryEventAt
				? new Date(request.sentryEventAt)
				: null,
			userAgent: request.context?.userAgent ?? null,
			viewportWidth: request.context?.viewport?.width ?? null,
			viewportHeight: request.context?.viewport?.height ?? null,
			locale: request.context?.locale ?? null,
			screenshotUrl,
			createdAt: submittedAt,
		});
		await this.repository.insertActivity({
			feedbackId,
			kind: "received",
		});

		const issueId =
			linearReady && teamId
				? await this.mirrorToLinear(
						feedbackId,
						teamId,
						user,
						request,
						submittedAt,
						linearAssetUrl,
					)
				: null;

		return { feedbackId, issueId };
	}

	private buildTitle(message: string, category?: FeedbackCategory): string {
		// The category comes from a closed zod enum, so it is safe as-is.
		const prefix = category ? `Feedback (${category})` : "Feedback";

		return `${prefix}: ${feedbackTitle(message)}`;
	}

	private async mirrorToLinear(
		feedbackId: string,
		teamId: string,
		user: AuthUser,
		request: CreateFeedbackRequest,
		submittedAt: Date,
		assetUrl: string | null,
	): Promise<string | null> {
		try {
			const labelId = await this.linearClient.findOrCreateLabel(
				teamId,
				FEEDBACK_LABEL_NAME,
			);
			const issue = await this.linearClient.createIssue({
				description: this.buildDescription(
					user,
					request,
					submittedAt,
					assetUrl,
					feedbackId,
				),
				labelIds: [labelId],
				teamId,
				title: this.buildTitle(request.message, request.category),
			});

			await this.repository.setLinearIssue(feedbackId, {
				issueId: issue.identifier,
				url: issue.url,
			});

			return issue.identifier;
		} catch (error) {
			this.logger.error(
				`Linear mirror failed for feedback ${feedbackId}`,
				error instanceof Error ? error.message : String(error),
			);
			Sentry.captureException(error, {
				tags: { feature: "feedback" },
				extra: { feedbackId },
			});

			return null;
		}
	}

	private buildDescription(
		user: AuthUser,
		request: CreateFeedbackRequest,
		submittedAt: Date,
		assetUrl: string | null,
		feedbackId: string,
	): string {
		const lines: string[] = [];

		// The message keeps its line structure inside the blockquote, but each line
		// is escaped so an `![](...)` or a `#` heading cannot leave the quote.
		for (const line of request.message.split("\n")) {
			lines.push(`> ${escapeMarkdown(line)}`);
		}

		lines.push("");

		// The category comes from a closed zod enum, so it needs no escape.
		if (request.category) {
			lines.push(`**Category:** ${request.category}`);
		}

		// The display name is user-chosen at signup, so it is escaped like the
		// message. Email and id pass through the same code-span cleanup.
		lines.push(
			`**User:** ${escapeMarkdown(user.name || "Unknown")} (${codeSpan(user.email)}) — ${codeSpan(user.id)}`,
		);
		lines.push(`**Page URL:** ${renderUrl(request.pageUrl)}`);
		lines.push(`**Submitted at:** ${submittedAt.toISOString()}`);
		lines.push(`**Feedback id:** ${codeSpan(feedbackId)}`);

		if (request.replayUrl) {
			lines.push(`**Session replay:** ${renderUrl(request.replayUrl)}`);
		}

		const sentryLine = this.sentryLine(request, submittedAt);

		if (sentryLine) {
			lines.push(sentryLine);
		}

		const browserLine = this.browserLine(request.context);

		if (browserLine) {
			lines.push(browserLine);
		}

		if (assetUrl) {
			lines.push("");
			lines.push(`![Screenshot](${assetUrl})`);
		}

		return lines.join("\n");
	}

	private sentryLine(
		request: CreateFeedbackRequest,
		submittedAt: Date,
	): string | null {
		if (!request.sentryEventId) {
			return null;
		}

		const eventAt = request.sentryEventAt
			? new Date(request.sentryEventAt)
			: null;
		const ageMs =
			eventAt && !Number.isNaN(eventAt.getTime())
				? submittedAt.getTime() - eventAt.getTime()
				: null;
		const eventId = codeSpan(request.sentryEventId);

		// Without a usable timestamp the error can be minutes or hours old, so the
		// line must not tell the reader that it is recent.
		if (ageMs === null) {
			return `**Last error (age unknown, maybe unrelated):** ${eventId}`;
		}

		if (ageMs <= SENTRY_RECENT_ERROR_MS) {
			return `**Recent error:** ${eventId}`;
		}

		const ageMinutes = Math.round(ageMs / 60_000);

		return `**Last error (${ageMinutes} min before submit, maybe unrelated):** ${eventId}`;
	}

	private browserLine(
		context: CreateFeedbackRequest["context"],
	): string | null {
		if (!context) {
			return null;
		}

		const parts: string[] = [];

		// The browser sends these strings, so they go inside code spans.
		if (context.userAgent) {
			parts.push(codeSpan(context.userAgent));
		}

		if (context.viewport) {
			parts.push(`${context.viewport.width}x${context.viewport.height}`);
		}

		if (context.locale) {
			parts.push(codeSpan(context.locale));
		}

		return parts.length > 0 ? `**Browser:** ${parts.join(" — ")}` : null;
	}
}
