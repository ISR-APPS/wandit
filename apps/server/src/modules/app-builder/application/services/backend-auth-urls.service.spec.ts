import { previewAuthRedirectPattern } from "@wandit/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AppBackendRow } from "../../infrastructure/persistence/app-backends.repository";
import { jsonResponse } from "../../infrastructure/supabase/fake-supabase-fetch";
import {
	ACTIVE_BACKEND_ROW,
	createBackendToolFixture,
} from "../host-tools/backend/fake-backend-tool-deps";
import { BackendAuthUrlsService } from "./backend-auth-urls.service";

const PREVIEW_DOMAIN = "preview.wandit.dev";
const PATTERN = previewAuthRedirectPattern("project-1", PREVIEW_DOMAIN);

type Domain = { name: string; isPrimary: boolean };

// The two PATCH bodies of a sync. `strictObject` fails on any other key, so
// no PATCH can hold `smtp_pass` or the sign-up mode `mailer_autoconfirm`.
const sentAuthUrlsSchema = z.strictObject({
	site_url: z.string(),
	uri_allow_list: z.string(),
});
const sentSenderNameSchema = z.strictObject({
	smtp_sender_name: z.string(),
	mailer_templates_confirmation_content: z.string(),
});

type CurrentAuthConfig = {
	site_url: string | null;
	uri_allow_list: string | null;
	/** Default null: a backend that sends no email through the Wandit sender. */
	smtp_host?: string | null;
	smtp_sender_name?: string | null;
};

// The service on the fixture's real client. The first scripted answer is
// the current auth config; the next ones answer the PATCH calls.
async function runSync(input: {
	domains?: Domain[];
	slug?: string | null;
	previewDomain?: string | null;
	current?: CurrentAuthConfig;
	/** `projects.name`; null means that no project row exists. */
	projectName?: string | null;
	backend?: AppBackendRow | null;
	withClient?: boolean;
}) {
	const current = input.current ?? { site_url: null, uri_allow_list: null };
	const fixture = await createBackendToolFixture({
		answers: [
			jsonResponse(
				200,
				JSON.stringify({
					smtp_host: null,
					smtp_sender_name: null,
					...current,
					external_email_enabled: true,
				}),
			),
			jsonResponse(200, "{}"),
			jsonResponse(200, "{}"),
		],
		backend: input.backend,
		withClient: input.withClient,
	});
	const service = new BackendAuthUrlsService({
		backends: fixture.deps.backends,
		client: fixture.deps.client,
		domains: { findActiveByProject: async () => input.domains ?? [] },
		findLiveSlug: async () => input.slug ?? null,
		findProjectName: async () =>
			input.projectName === undefined ? "Nour Objets" : input.projectName,
		logger: {
			error: () => undefined,
			info: () => undefined,
			warn: () => undefined,
		},
		previewDomain:
			input.previewDomain === undefined ? PREVIEW_DOMAIN : input.previewDomain,
		sitesDomain: "wandit.app",
	});
	const result = await service.sync("project-1");
	const patchBodies = fixture.requests
		.filter((request) => request.method === "PATCH")
		.map((request) =>
			z
				.union([sentAuthUrlsSchema, sentSenderNameSchema])
				.parse(JSON.parse(request.body ?? "null")),
		);
	return {
		patchBody: patchBodies.find((body) => "site_url" in body) ?? null,
		senderNameBody:
			patchBodies.find((body) => "smtp_sender_name" in body) ?? null,
		requests: fixture.requests,
		result,
	};
}

describe("BackendAuthUrlsService site_url", () => {
	it.each<{
		case: string;
		domains: Domain[];
		slug: string | null;
		expected: string;
	}>([
		{
			case: "the primary domain, even when it is not first",
			domains: [
				{ isPrimary: false, name: "shop.io" },
				{ isPrimary: true, name: "example.com" },
			],
			slug: "my-app",
			expected: "https://www.example.com",
		},
		{
			case: "another domain when none is primary",
			domains: [{ isPrimary: false, name: "www.shop.io" }],
			slug: "my-app",
			expected: "https://www.shop.io",
		},
		{
			case: "the slug host without a domain",
			domains: [],
			slug: "my-app",
			expected: "https://my-app.wandit.app",
		},
		{
			case: "the preview apex before the first publish",
			domains: [],
			slug: null,
			expected: `https://${PREVIEW_DOMAIN}`,
		},
	])("is $case", async ({ domains, slug, expected }) => {
		const { patchBody, result } = await runSync({ domains, slug });

		expect(result).toBe("updated");
		expect(patchBody?.site_url).toBe(expected);
	});
});

describe("BackendAuthUrlsService uri_allow_list", () => {
	it("keeps the preview pattern and adds each live host, and sends only the two URL fields", async () => {
		const { patchBody } = await runSync({
			current: {
				site_url: `https://${PREVIEW_DOMAIN}`,
				uri_allow_list: PATTERN,
			},
			domains: [
				{ isPrimary: true, name: "example.com" },
				// The apex and the www name give one host.
				{ isPrimary: false, name: "www.example.com" },
			],
			slug: "my-app",
		});

		expect(patchBody).toEqual({
			site_url: "https://www.example.com",
			uri_allow_list: `${PATTERN},https://www.example.com/**,https://my-app.wandit.app/**`,
		});
	});

	it("drops a domain that is gone", async () => {
		const { patchBody } = await runSync({
			current: {
				site_url: "https://www.gone.com",
				uri_allow_list: `${PATTERN},https://www.gone.com/**,https://my-app.wandit.app/**`,
			},
			domains: [],
			slug: "my-app",
		});

		expect(patchBody).toEqual({
			site_url: "https://my-app.wandit.app",
			uri_allow_list: `${PATTERN},https://my-app.wandit.app/**`,
		});
	});

	it("answers unchanged and sends no PATCH when the stored config is equal in another order", async () => {
		const { requests, result } = await runSync({
			current: {
				site_url: "https://my-app.wandit.app",
				uri_allow_list: `https://my-app.wandit.app/**, ${PATTERN}`,
			},
			domains: [],
			slug: "my-app",
		});

		expect(result).toBe("unchanged");
		expect(requests.map((request) => request.method)).toEqual(["GET"]);
	});
});

describe("BackendAuthUrlsService sender name", () => {
	// A backend that sends the code email through the Wandit sender. The
	// project name changed after provisioning; the URLs are up to date.
	const STALE_NAME = {
		site_url: "https://my-app.wandit.app",
		uri_allow_list: `${PATTERN},https://my-app.wandit.app/**`,
		smtp_host: "smtp.resend.com",
		smtp_sender_name: "Build a shop for my",
	};

	it.each<{ case: string; previewDomain?: string | null; slug: string | null }>(
		[
			{ case: "the URLs are up to date", slug: "my-app" },
			{
				case: "the worker has no host for the URLs",
				previewDomain: null,
				slug: null,
			},
		],
	)("sends only the new name and the email body when $case", async (input) => {
		const { requests, result, senderNameBody } = await runSync({
			...input,
			current: STALE_NAME,
			// The braces would start a Go template action in the email body.
			projectName: "Nour {{ .SiteURL }} Objets",
		});

		expect(result).toBe("updated");
		expect(requests.map((request) => request.method)).toEqual(["GET", "PATCH"]);
		expect(senderNameBody).toEqual({
			smtp_sender_name: "Nour .SiteURL Objets",
			mailer_templates_confirmation_content: expect.stringContaining(
				"<b>Nour .SiteURL Objets</b>",
			),
		});
	});

	it.each<{ case: string; current: CurrentAuthConfig; projectName?: null }>([
		{
			case: "the name is equal",
			current: { ...STALE_NAME, smtp_sender_name: "Nour Objets" },
		},
		{
			case: "the backend has no Wandit sender",
			current: { ...STALE_NAME, smtp_host: null, smtp_sender_name: null },
		},
		{ case: "the project row is gone", current: STALE_NAME, projectName: null },
	])("answers unchanged and sends no PATCH when $case", async (input) => {
		const { requests, result } = await runSync({ ...input, slug: "my-app" });

		expect(result).toBe("unchanged");
		expect(requests.map((request) => request.method)).toEqual(["GET"]);
	});
});

describe("BackendAuthUrlsService skip", () => {
	it.each<{
		case: string;
		backend?: AppBackendRow | null;
		withClient?: boolean;
	}>([
		{ case: "no backend row", backend: null },
		{
			case: "a paused backend",
			backend: { ...ACTIVE_BACKEND_ROW, status: "paused" },
		},
		{ case: "no Management API client", withClient: false },
	])("answers skipped with no call for $case", async (input) => {
		const { requests, result } = await runSync({ ...input, slug: null });

		expect(result).toBe("skipped");
		expect(requests).toHaveLength(0);
	});
});
