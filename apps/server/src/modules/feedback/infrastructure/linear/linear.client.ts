import { Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";

import {
	FeedbackNotConfiguredError,
	FeedbackProviderError,
} from "../../domain/errors/feedback.errors";
import {
	FEEDBACK_LABEL_COLOR,
	FEEDBACK_LABEL_NAME,
} from "../../feedback.constants";
import { decodeScreenshotDataUrl } from "../screenshot-data-url";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const REQUEST_TIMEOUT_MS = 15_000;
const SCREENSHOT_FILENAMES = {
	"image/jpeg": "feedback-screenshot.jpg",
	"image/png": "feedback-screenshot.png",
} as const;

type GraphqlResponse = {
	data?: unknown;
	errors?: unknown;
};

type UploadHeader = {
	key: string;
	value: string;
};

type UploadFile = {
	assetUrl: string;
	headers: UploadHeader[];
	uploadUrl: string;
};

export type CreateIssueInput = {
	description: string;
	labelIds: string[];
	teamId: string;
	title: string;
};

export type CreatedLinearIssue = {
	identifier: string;
	url: string | null;
};

// Linear rejects a new label when the name is already taken, and that check
// ignores case and also sees workspace-level and archived labels. The lookup
// must therefore see everything the check sees, not only the team's live labels.
const LABEL_QUERY = `
	query FeedbackLabel($teamId: ID!, $name: String!) {
		issueLabels(
			filter: {
				name: { eqIgnoreCase: $name }
				or: [{ team: { id: { eq: $teamId } } }, { team: { null: true } }]
			}
			includeArchived: true
			first: 10
		) {
			nodes { id archivedAt team { id } }
		}
	}
`;

const LABEL_CREATE_MUTATION = `
	mutation CreateFeedbackLabel($input: IssueLabelCreateInput!) {
		issueLabelCreate(input: $input) {
			success
			issueLabel { id }
		}
	}
`;

const FILE_UPLOAD_MUTATION = `
	mutation FeedbackFileUpload(
		$contentType: String!
		$filename: String!
		$size: Int!
	) {
		fileUpload(contentType: $contentType, filename: $filename, size: $size) {
			success
			uploadFile {
				uploadUrl
				assetUrl
				headers { key value }
			}
		}
	}
`;

const ISSUE_CREATE_MUTATION = `
	mutation CreateFeedbackIssue($input: IssueCreateInput!) {
		issueCreate(input: $input) {
			success
			issue { id identifier url }
		}
	}
`;

/**
 * The only code that knows Linear's GraphQL contract.
 *
 * The application layer asks for a label, an upload, and an issue. Changes to
 * Linear stay inside this adapter.
 */
@Injectable()
export class LinearClient {
	private readonly logger = new Logger(LinearClient.name);
	// One lookup per label per process. A label id stays valid until somebody
	// deletes or merges the label in Linear, so `createIssue` drops the entry and
	// resolves again when an issue create fails. The map holds the in-flight
	// promise, which keeps two cold-cache requests from doing the work twice.
	private readonly labelIds = new Map<string, Promise<string>>();

	/**
	 * Returns the id of the feedback label, and creates the label the first time
	 * the team does not have it.
	 */
	async findOrCreateLabel(
		teamId: string,
		name = FEEDBACK_LABEL_NAME,
	): Promise<string> {
		const cacheKey = `${teamId}:${name}`;
		const cached = this.labelIds.get(cacheKey);

		if (cached) {
			return await cached;
		}

		const pending = this.resolveLabel(teamId, name);

		this.labelIds.set(cacheKey, pending);
		// A failed lookup must not stay in the map, or every later request fails
		// with the same old error.
		pending.catch(() => {
			if (this.labelIds.get(cacheKey) === pending) {
				this.labelIds.delete(cacheKey);
			}
		});

		return await pending;
	}

	/** Finds the best matching label, or creates it. No cache logic here. */
	private async resolveLabel(teamId: string, name: string): Promise<string> {
		const found = await this.request(LABEL_QUERY, { name, teamId });
		const nodes = this.arrayValue(
			this.recordValue(this.recordValue(found)?.issueLabels)?.nodes,
		);

		let teamLabelId: string | null = null;
		let workspaceLabelId: string | null = null;
		let archivedLabelId: string | null = null;

		for (const value of nodes) {
			const node = this.recordValue(value);
			const id = this.stringValue(node?.id);

			if (!id) {
				continue;
			}

			if (this.stringValue(node?.archivedAt)) {
				archivedLabelId ??= id;
				continue;
			}

			const nodeTeamId = this.stringValue(this.recordValue(node?.team)?.id);

			if (nodeTeamId === teamId) {
				teamLabelId ??= id;
			} else if (!nodeTeamId) {
				workspaceLabelId ??= id;
			}
		}

		// A team label is the closest match. A workspace label works too.
		const existing = teamLabelId ?? workspaceLabelId;

		if (existing) {
			return existing;
		}

		// Only an archived label holds the name. A create would fail on the name
		// check, so tell the operator what to do instead of retrying forever.
		if (archivedLabelId) {
			throw new FeedbackProviderError(
				`Linear label "${name}" exists but is archived. Restore it in Linear, or rename it, so feedback issues can use the name.`,
			);
		}

		const created = await this.request(LABEL_CREATE_MUTATION, {
			input: { color: FEEDBACK_LABEL_COLOR, name, teamId },
		});
		const createdId = this.stringValue(
			this.recordValue(
				this.recordValue(this.recordValue(created)?.issueLabelCreate)
					?.issueLabel,
			)?.id,
		);

		if (!createdId) {
			throw new FeedbackProviderError("Linear label create failed");
		}

		return createdId;
	}

	/**
	 * Uploads the screenshot and returns its asset URL.
	 *
	 * The image is a nice-to-have: every failure answers null so the caller can
	 * still create the issue.
	 */
	async uploadScreenshot(dataUrl: string): Promise<string | null> {
		try {
			const decoded = decodeScreenshotDataUrl(dataUrl);

			if (!decoded) {
				return null;
			}

			const payload = await this.request(FILE_UPLOAD_MUTATION, {
				contentType: decoded.contentType,
				filename: SCREENSHOT_FILENAMES[decoded.contentType],
				size: decoded.bytes.byteLength,
			});
			const uploadFile = this.uploadFileValue(payload);

			if (!uploadFile) {
				return null;
			}

			const headers: Record<string, string> = {
				"Content-Type": decoded.contentType,
			};

			for (const header of uploadFile.headers) {
				headers[header.key] = header.value;
			}

			const upload = await fetch(uploadFile.uploadUrl, {
				body: new Uint8Array(decoded.bytes),
				headers,
				method: "PUT",
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});

			if (!upload.ok) {
				this.logger.warn(
					`Linear screenshot upload failed with status ${upload.status}`,
				);
				return null;
			}

			return uploadFile.assetUrl;
		} catch (error) {
			this.logger.warn(
				`Linear screenshot upload failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return null;
		}
	}

	/** Creates an issue and returns its identifier and optional Linear URL. */
	async createIssue(input: CreateIssueInput): Promise<CreatedLinearIssue> {
		try {
			return await this.postIssue(input);
		} catch (error) {
			// A cached label id goes stale when somebody deletes or merges the label
			// in Linear, and the issue create then fails. Forget the id, resolve the
			// label again, and try once more with the new id.
			const staleId = await this.forgetLabel(input.teamId);
			const freshId = await this.findOrCreateLabel(input.teamId);

			// The same id means the label was not the problem.
			if (staleId === freshId) {
				throw error;
			}

			return await this.postIssue({
				...input,
				labelIds: input.labelIds.map((id) => (id === staleId ? freshId : id)),
			});
		}
	}

	/** Removes the cached label id and answers the id it removed. */
	private async forgetLabel(
		teamId: string,
		name = FEEDBACK_LABEL_NAME,
	): Promise<string | null> {
		const cached = this.labelIds.get(`${teamId}:${name}`);

		this.labelIds.delete(`${teamId}:${name}`);

		return cached ? await cached.catch(() => null) : null;
	}

	private async postIssue(
		input: CreateIssueInput,
	): Promise<CreatedLinearIssue> {
		const payload = await this.request(ISSUE_CREATE_MUTATION, {
			input: {
				description: input.description,
				labelIds: input.labelIds,
				teamId: input.teamId,
				title: input.title,
			},
		});
		const issue = this.recordValue(
			this.recordValue(this.recordValue(payload)?.issueCreate)?.issue,
		);
		const identifier = this.stringValue(issue?.identifier);

		if (!identifier) {
			throw new FeedbackProviderError("Linear issue create failed");
		}

		return { identifier, url: this.stringValue(issue?.url) };
	}

	private async request(
		query: string,
		variables: Record<string, unknown>,
	): Promise<unknown> {
		const apiKey = env.LINEAR_API_KEY;

		if (!apiKey) {
			throw new FeedbackNotConfiguredError();
		}

		let response: Response;

		try {
			response = await fetch(LINEAR_GRAPHQL_URL, {
				body: JSON.stringify({ query, variables }),
				headers: {
					// Linear personal API keys are sent raw, without a Bearer prefix.
					Authorization: apiKey,
					"Content-Type": "application/json",
				},
				method: "POST",
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			this.logger.error(
				"Linear GraphQL request could not reach the API",
				error instanceof Error ? error.message : String(error),
			);
			throw new FeedbackProviderError();
		}

		const payload = (await this.safeJson(response)) as GraphqlResponse | null;

		if (!response.ok) {
			this.logger.error(
				`Linear GraphQL request failed with status ${response.status}`,
			);
			throw new FeedbackProviderError();
		}

		// GraphQL answers HTTP 200 with an errors array on failure.
		if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
			this.logger.error(
				`Linear GraphQL request returned errors: ${JSON.stringify(
					payload.errors,
				)}`,
			);
			throw new FeedbackProviderError();
		}

		return payload?.data ?? null;
	}

	private uploadFileValue(payload: unknown): UploadFile | null {
		const uploadFile = this.recordValue(
			this.recordValue(this.recordValue(payload)?.fileUpload)?.uploadFile,
		);
		const assetUrl = this.stringValue(uploadFile?.assetUrl);
		const uploadUrl = this.stringValue(uploadFile?.uploadUrl);

		if (!assetUrl || !uploadUrl) {
			return null;
		}

		const headers: UploadHeader[] = [];

		for (const value of this.arrayValue(uploadFile?.headers)) {
			const header = this.recordValue(value);
			const key = this.stringValue(header?.key);
			const headerValue = this.stringValue(header?.value);

			if (key && headerValue) {
				headers.push({ key, value: headerValue });
			}
		}

		return { assetUrl, headers, uploadUrl };
	}

	private async safeJson(response: Response): Promise<unknown> {
		try {
			return await response.json();
		} catch {
			return null;
		}
	}

	private recordValue(value: unknown): Record<string, unknown> | null {
		return typeof value === "object" && value !== null && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	}

	private arrayValue(value: unknown): unknown[] {
		return Array.isArray(value) ? value : [];
	}

	private stringValue(value: unknown): string | null {
		return typeof value === "string" && value.length > 0 ? value : null;
	}
}
