import { BadRequestException } from "@nestjs/common";
import type { GithubInstallation } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { GithubOAuthRejectedError } from "../../infrastructure/github/github-app.client";
import type {
	GithubConnection,
	GithubPendingConnect,
} from "../../infrastructure/persistence/github-connections.repository";
import { GithubAccountService } from "./github-account.service";

// The vitest config sets CORS_ORIGIN to http://web.test.
const RETURN_URL = "http://web.test/projects/p-1?view=more&panel=integrations";

const PENDING: GithubPendingConnect = {
	id: "connection-1",
	oauthStateCreatedAt: new Date(),
	returnUrl: RETURN_URL,
	userId: "user-1",
};

// GitHub user id of octocat.
const OCTOCAT_ID = 583231;

const INSTALLATION: GithubInstallation = {
	accountId: OCTOCAT_ID,
	accountLogin: "octocat",
	accountType: "User",
	id: 1,
};

// An access token past its expiry, with the refresh token that the refresh sends.
const EXPIRED: GithubConnection = {
	accessToken: "ghu_old",
	accessTokenExpiresAt: new Date(Date.now() - 60_000),
	encryptedRefreshToken: "encrypted-ghr_old",
	githubLogin: "octocat",
	githubUserId: OCTOCAT_ID,
	refreshToken: "ghr_old",
};

// The row after another request refreshed first: a new token with 8 h of life.
const REFRESHED_ELSEWHERE: GithubConnection = {
	...EXPIRED,
	accessToken: "ghu_new",
	accessTokenExpiresAt: new Date(Date.now() + 8 * 3_600_000),
	encryptedRefreshToken: "encrypted-ghr_new",
	refreshToken: "ghr_new",
};

function fixture(options?: {
	/** Answer of `claimState`; default true. */
	claimed?: boolean;
	/** Answer of `clearTokensIfRefreshTokenMatches`; default true. */
	cleared?: boolean;
	/** Answer of `findByState`; default `PENDING`. */
	pending?: GithubPendingConnect;
}) {
	const github = {
		authorizeUrl: vi.fn(() => "https://github.com/login/oauth/authorize"),
		exchangeCode: vi.fn(async () => ({
			accessToken: "ghu_new",
			accessTokenExpiresAt: null,
			refreshToken: null,
			refreshTokenExpiresAt: null,
		})),
		getUser: vi.fn(async () => ({ id: OCTOCAT_ID, login: "octocat" })),
		installUrl: vi.fn(() => "https://github.com/apps/wandit/installations/new"),
		isConfigured: () => true,
		// Only the token that another request saved still works.
		listUserInstallations: vi.fn(async (token: string) =>
			token === "ghu_new" ? [INSTALLATION] : [],
		),
		// GitHub accepts each refresh token once; this one was used already.
		refreshUserToken: vi.fn(async () => {
			throw new GithubOAuthRejectedError(
				"GitHub refused the token request (bad_refresh_token)",
				200,
			);
		}),
	};
	const connections = {
		claimState: vi.fn(async () => options?.claimed ?? true),
		clearTokensIfRefreshTokenMatches: vi.fn(
			async () => options?.cleared ?? true,
		),
		deleteByUser: vi.fn(async () => undefined),
		findByState: vi.fn(async () => options?.pending ?? PENDING),
		findByUser: vi.fn(async (): Promise<GithubConnection | null> => null),
		saveTokens: vi.fn(async () => undefined),
		updateTokensIfRefreshTokenMatches: vi.fn(async () => true),
		upsertPendingState: vi.fn(async () => undefined),
	};
	return {
		connections,
		github,
		service: new GithubAccountService(github, connections),
	};
}

describe("GithubAccountService.authorize", () => {
	// Security: the callback redirects the browser to the stored URL.
	it("answers 400 and stores no state for a return URL on another origin", async () => {
		const { connections, service } = fixture();

		await expect(
			service.authorize("user-1", {
				flow: "authorize",
				returnUrl: "https://attacker.test/projects/p-1",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(connections.upsertPendingState).not.toHaveBeenCalled();
	});
});

describe("GithubAccountService.handleCallback", () => {
	// Security: each row is a callback that must not connect a GitHub account to user-1.
	it.each([
		{
			claimed: true,
			pending: {
				...PENDING,
				oauthStateCreatedAt: new Date(Date.now() - 11 * 60_000),
			},
			reason: "a state older than 10 minutes",
			sessionUserId: "user-1",
		},
		{
			claimed: true,
			pending: PENDING,
			reason: "the session of another user",
			sessionUserId: "user-2",
		},
		{
			claimed: false,
			pending: PENDING,
			reason: "a state that another request used",
			sessionUserId: "user-1",
		},
	])("answers invalid_state and exchanges no code for $reason", async ({
		claimed,
		pending,
		sessionUserId,
	}) => {
		const { connections, github, service } = fixture({ claimed, pending });

		const url = new URL(
			await service.handleCallback(
				{ code: "code-1", state: "state-1" },
				sessionUserId,
			),
		);

		expect(`${url.origin}${url.pathname}`).toBe("http://web.test/projects/p-1");
		expect(url.searchParams.get("github_error")).toBe("invalid_state");
		expect(github.exchangeCode).not.toHaveBeenCalled();
		expect(connections.saveTokens).not.toHaveBeenCalled();
	});
});

describe("GithubAccountService.account", () => {
	// Two tabs or two API processes can refresh at the same time. The loser
	// must not delete the tokens that the winner saved.
	it.each([
		{
			cleared: true,
			expected: {
				appConfigured: true,
				connected: false,
				installations: [],
				login: null,
			},
			reason: "the row still holds the refused token",
		},
		{
			cleared: false,
			expected: {
				appConfigured: true,
				connected: true,
				installations: [INSTALLATION],
				login: "octocat",
			},
			reason: "another request saved new tokens first",
		},
	])("answers after a refused refresh when $reason", async ({
		cleared,
		expected,
	}) => {
		const { connections, service } = fixture({ cleared });
		connections.findByUser
			.mockResolvedValueOnce(EXPIRED)
			.mockResolvedValueOnce(REFRESHED_ELSEWHERE);

		await expect(service.account("user-1")).resolves.toEqual(expected);
	});
});
