/**
 * The GitHub user connection of the V2 GitHub sync: the account answer, the connect start, the
 * OAuth callback, and the disconnect. `GithubController` and `GithubCallbackController` call it.
 * `GithubProjectService` gets a usable user token through `userAccess`.
 * It calls `GithubAppClient` and `GithubConnectionsRepository`.
 */
import { randomBytes } from "node:crypto";

import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
} from "@nestjs/common";
import {
	appBuilderRoutes,
	GITHUB_CONNECTED_PARAM,
	GITHUB_ERROR_PARAM,
	type GithubAccountResponse,
	type GithubAuthorizeBody,
	type GithubAuthorizeResponse,
	type GithubCallbackErrorCode,
	type GithubCallbackQuery,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";

import {
	GithubApiError,
	GithubAppClient,
	GithubOAuthRejectedError,
	type GithubUserTokens,
} from "../../infrastructure/github/github-app.client";
import {
	type GithubConnection,
	GithubConnectionsRepository,
} from "../../infrastructure/persistence/github-connections.repository";

// 10 min, like the MCP connect: enough for a GitHub sign-in and an App install.
const OAUTH_STATE_TTL_MS = 10 * 60_000;
// 60 s. The link route makes three GitHub calls with one token. A token that
// ends during them would fail the link.
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60_000;
// 32 random bytes: the state is the only secret that binds the callback to the start.
const OAUTH_STATE_BYTES = 32;

/** A usable GitHub user token and the GitHub user it belongs to. */
export type GithubUserAccess = {
	accessToken: string;
	/** GitHub login saved at the callback, for display. A rename on GitHub makes it old. */
	githubLogin: string;
	/** Numeric GitHub user id saved at the callback. The link route compares it with a personal installation. */
	githubUserId: number;
};

/** Connect, callback, refresh, and disconnect of the GitHub user token. */
@Injectable()
export class GithubAccountService {
	private readonly logger = new Logger(GithubAccountService.name);
	// GitHub accepts each refresh token once. One refresh per user in this
	// process; the compare-and-swap writes cover other processes.
	private readonly refreshes = new Map<
		string,
		Promise<GithubUserAccess | null>
	>();

	constructor(
		// The Pick types keep each seam narrow; a spec passes plain fakes.
		@Inject(GithubAppClient)
		private readonly github: Pick<
			GithubAppClient,
			| "isConfigured"
			| "authorizeUrl"
			| "installUrl"
			| "exchangeCode"
			| "refreshUserToken"
			| "getUser"
			| "listUserInstallations"
		>,
		@Inject(GithubConnectionsRepository)
		private readonly connections: Pick<
			GithubConnectionsRepository,
			| "findByUser"
			| "findByState"
			| "upsertPendingState"
			| "claimState"
			| "saveTokens"
			| "updateTokensIfRefreshTokenMatches"
			| "clearTokensIfRefreshTokenMatches"
			| "deleteByUser"
		>,
	) {}

	/**
	 * The connection and the App installations that the user can reach. An expired token gets a
	 * refresh first. A refused refresh or a revoked token answers `connected: false`.
	 */
	async account(userId: string): Promise<GithubAccountResponse> {
		const notConnected = { connected: false, installations: [], login: null };
		if (!this.github.isConfigured()) {
			return { appConfigured: false, ...notConnected };
		}
		const access = await this.userAccess(userId);
		if (access === null) {
			return { appConfigured: true, ...notConnected };
		}
		try {
			const installations = await this.github.listUserInstallations(
				access.accessToken,
			);
			return {
				appConfigured: true,
				connected: true,
				// The list also holds personal installations of other users. The link
				// route refuses them, so the owner select must not offer them.
				installations: installations.filter(
					(installation) =>
						installation.accountType !== "User" ||
						installation.accountId === access.githubUserId,
				),
				login: access.githubLogin,
			};
		} catch (error) {
			// 401: the user revoked the App in GitHub. No write here: a connect in
			// another tab can have saved new tokens since the read. A new connect
			// overwrites the dead tokens.
			if (error instanceof GithubApiError && error.status === 401) {
				return { appConfigured: true, ...notConnected };
			}
			throw error;
		}
	}

	/**
	 * Stores a new connect state and answers the GitHub page to open: the sign-in for "authorize",
	 * the App install for "install". 400 when `returnUrl` is not on the web app origin.
	 */
	async authorize(
		userId: string,
		body: GithubAuthorizeBody,
	): Promise<GithubAuthorizeResponse> {
		// Security: the callback redirects the browser to this URL. Only the web
		// app origin is allowed, so the route is no open redirect.
		if (!isWebAppUrl(body.returnUrl)) {
			throw new BadRequestException({
				code: "VALIDATION_ERROR",
				message: "returnUrl must use the web app origin",
			});
		}
		const state = randomBytes(OAUTH_STATE_BYTES).toString("base64url");
		// The URL comes first: a missing GITHUB_APP_* value answers 503 before a
		// state is stored.
		const url =
			body.flow === "authorize"
				? this.github.authorizeUrl(state, githubCallbackUrl())
				: this.github.installUrl(state);
		await this.connections.upsertPendingState(userId, state, body.returnUrl);
		return { url };
	}

	/**
	 * Finishes a connect or an App install and answers the 302 target: the stored builder URL, or
	 * the web dashboard without one, with `github=connected` or `github_error=<code>`. A state older
	 * than 10 min, a state already used, or a session of another user answers `invalid_state` and
	 * exchanges no code.
	 * `sessionUserId` is the Better Auth session user of the browser, or null without a session.
	 */
	async handleCallback(
		query: GithubCallbackQuery,
		sessionUserId: string | null,
	): Promise<string> {
		if (query.state === undefined) {
			return callbackRedirect(null, "invalid_state");
		}
		const pending = await this.connections.findByState(query.state);
		if (pending === null) {
			return callbackRedirect(null, "invalid_state");
		}
		// Security: the state is single use. The claim clears it, so a replayed or
		// a refused callback cannot use it again.
		const claimed = await this.connections.claimState(pending.id, query.state);
		const isFresh =
			pending.oauthStateCreatedAt !== null &&
			Date.now() - pending.oauthStateCreatedAt.getTime() <= OAUTH_STATE_TTL_MS;
		// Security: the callback rides the browser of the user. Its session must be
		// the user who started the connect, so a link that another person sends
		// cannot connect their GitHub account to this user.
		if (!claimed || !isFresh || sessionUserId !== pending.userId) {
			return callbackRedirect(pending.returnUrl, "invalid_state");
		}
		if (query.error !== undefined) {
			return callbackRedirect(pending.returnUrl, "access_denied");
		}
		// An App install without the OAuth step comes back without a code. The
		// install is done on GitHub, and the user token stays as it was.
		if (query.code === undefined) {
			return callbackRedirect(pending.returnUrl, null);
		}
		try {
			const tokens = await this.github.exchangeCode(
				query.code,
				githubCallbackUrl(),
			);
			const user = await this.github.getUser(tokens.accessToken);
			await this.connections.saveTokens(pending.userId, user, tokens);
		} catch (error) {
			// A GitHub error message names the call and the status, never a token.
			this.logger.warn(
				`GitHub connect failed for user ${pending.userId}: ${getErrorMessage(error)}`,
			);
			return callbackRedirect(pending.returnUrl, "exchange_failed");
		}
		return callbackRedirect(pending.returnUrl, null);
	}

	/** Removes the user connection. Project links keep working: the sync uses installation tokens. */
	async disconnect(userId: string): Promise<void> {
		await this.connections.deleteByUser(userId);
	}

	/**
	 * A usable user token: the stored one, or a new one after a refresh. Null when the user must
	 * connect again. A refused refresh clears the tokens only when no other request saved new ones
	 * first. A network failure throws and keeps the stored tokens.
	 */
	async userAccess(userId: string): Promise<GithubUserAccess | null> {
		const connection = await this.connections.findByUser(userId);
		if (connection === null) {
			return null;
		}
		const usable = usableAccess(connection);
		if (usable !== null) {
			return usable;
		}
		const { encryptedRefreshToken, githubLogin, githubUserId, refreshToken } =
			connection;
		if (
			encryptedRefreshToken === null ||
			refreshToken === null ||
			githubLogin === null ||
			githubUserId === null
		) {
			return null;
		}
		const inFlight = this.refreshes.get(userId);
		if (inFlight !== undefined) {
			return inFlight;
		}
		const refresh = this.refresh(
			userId,
			{ githubLogin, githubUserId },
			{ encrypted: encryptedRefreshToken, plain: refreshToken },
		);
		this.refreshes.set(userId, refresh);
		try {
			return await refresh;
		} finally {
			if (this.refreshes.get(userId) === refresh) {
				this.refreshes.delete(userId);
			}
		}
	}

	// One refresh. Every write is a compare-and-swap on the stored refresh
	// token, so a request that lost the race reads the winner's tokens.
	private async refresh(
		userId: string,
		githubUser: Omit<GithubUserAccess, "accessToken">,
		refreshToken: {
			/** Stored ciphertext; the compare-and-swap input. */
			encrypted: string;
			/** Decrypted value that GitHub reads. */
			plain: string;
		},
	): Promise<GithubUserAccess | null> {
		let tokens: GithubUserTokens;
		try {
			tokens = await this.github.refreshUserToken(refreshToken.plain);
		} catch (error) {
			if (!(error instanceof GithubOAuthRejectedError)) {
				throw error;
			}
			// GitHub refuses a used refresh token. Another API process can have used
			// it first and saved new tokens; those must stay.
			const cleared = await this.connections.clearTokensIfRefreshTokenMatches(
				userId,
				refreshToken.encrypted,
			);
			return cleared ? null : this.readUsableAccess(userId);
		}
		const saved = await this.connections.updateTokensIfRefreshTokenMatches(
			userId,
			refreshToken.encrypted,
			tokens,
		);
		if (!saved) {
			// Another request saved tokens first. The row then holds the tokens to use.
			return this.readUsableAccess(userId);
		}
		return { accessToken: tokens.accessToken, ...githubUser };
	}

	private async readUsableAccess(
		userId: string,
	): Promise<GithubUserAccess | null> {
		const latest = await this.connections.findByUser(userId);
		return latest === null ? null : usableAccess(latest);
	}
}

// The stored token while it has more than the skew left, or null. A row
// without a GitHub user id reads as not connected, so the user connects again.
function usableAccess(connection: GithubConnection): GithubUserAccess | null {
	if (
		connection.accessToken === null ||
		connection.githubLogin === null ||
		connection.githubUserId === null
	) {
		return null;
	}
	const expiresAt = connection.accessTokenExpiresAt;
	if (
		expiresAt !== null &&
		expiresAt.getTime() - Date.now() <= ACCESS_TOKEN_EXPIRY_SKEW_MS
	) {
		return null;
	}
	return {
		accessToken: connection.accessToken,
		githubLogin: connection.githubLogin,
		githubUserId: connection.githubUserId,
	};
}

// The API callback URL that GitHub redirects to; the App settings hold the same URL.
function githubCallbackUrl(): string {
	return new URL(
		appBuilderRoutes.githubCallback,
		env.BETTER_AUTH_URL,
	).toString();
}

function isWebAppUrl(url: string): boolean {
	return new URL(url).origin === new URL(env.CORS_ORIGIN).origin;
}

/**
 * The web dashboard URL. The callback redirects there when it has no builder URL to return to.
 * Every web page reads the GitHub params and shows the toast. `GithubCallbackController` also uses it.
 */
export function githubCallbackFallbackUrl(): URL {
	return new URL("/dashboard", env.CORS_ORIGIN);
}

// The 302 target of the callback: the stored builder URL with one result
// param. `error` null means connected. A missing URL, or one on another
// origin, falls back to the web dashboard, so the redirect never leaves the web app.
// The root route `/` sends a signed-in user to the dashboard without the param.
function callbackRedirect(
	returnUrl: string | null,
	error: GithubCallbackErrorCode | null,
): string {
	const redirect =
		returnUrl !== null && isWebAppUrl(returnUrl)
			? new URL(returnUrl)
			: githubCallbackFallbackUrl();
	// A return URL can still hold the param of an earlier connect.
	redirect.searchParams.delete(GITHUB_CONNECTED_PARAM);
	redirect.searchParams.delete(GITHUB_ERROR_PARAM);
	if (error === null) {
		redirect.searchParams.set(GITHUB_CONNECTED_PARAM, "connected");
	} else {
		redirect.searchParams.set(GITHUB_ERROR_PARAM, error);
	}
	return redirect.toString();
}
