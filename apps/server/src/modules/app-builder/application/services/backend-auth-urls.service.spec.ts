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

// The PATCH body; `strictObject` fails on any key past the two URL fields.
const sentAuthUrlsSchema = z.strictObject({
	site_url: z.string(),
	uri_allow_list: z.string(),
});

// The service on the fixture's real client. The first scripted answer is
// the current auth config; the second one answers the PATCH.
async function runSync(input: {
	domains?: Domain[];
	slug?: string | null;
	previewDomain?: string | null;
	current?: { site_url: string | null; uri_allow_list: string | null };
	backend?: AppBackendRow | null;
	withClient?: boolean;
}) {
	const current = input.current ?? { site_url: null, uri_allow_list: null };
	const fixture = await createBackendToolFixture({
		answers: [
			jsonResponse(
				200,
				JSON.stringify({ ...current, external_email_enabled: true }),
			),
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
	const patch = fixture.requests.find((request) => request.method === "PATCH");
	return {
		patchBody:
			patch === undefined
				? null
				: sentAuthUrlsSchema.parse(JSON.parse(patch.body ?? "null")),
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

describe("BackendAuthUrlsService skip", () => {
	it.each<{
		case: string;
		backend?: AppBackendRow | null;
		withClient?: boolean;
		previewDomain?: string | null;
	}>([
		{ case: "no backend row", backend: null },
		{
			case: "a paused backend",
			backend: { ...ACTIVE_BACKEND_ROW, status: "paused" },
		},
		{ case: "no Management API client", withClient: false },
		{ case: "no host and no preview domain", previewDomain: null },
	])("answers skipped with no call for $case", async (input) => {
		const { requests, result } = await runSync({ ...input, slug: null });

		expect(result).toBe("skipped");
		expect(requests).toHaveLength(0);
	});
});
