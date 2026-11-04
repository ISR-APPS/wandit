/**
 * Serves the OAuth discovery documents of the MCP server outside the `/api` prefix (RFC 9728, RFC 8414).
 * An MCP client fetches them after a 401 from `POST /api/mcp`. main.ts excludes these paths from the prefix.
 * AuthModule mounts this controller only when V2_BUILDER_ENABLED is true, so the paths answer 404 otherwise.
 */
import { Controller, Get, Inject } from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import {
	MCP_ISSUER_URL,
	MCP_RESOURCE_URL,
} from "@wandit/auth/mcp-oauth-provider";
import { mcpRoutes, mcpScopes } from "@wandit/contracts";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { AUTH_INSTANCE } from "../../../auth.constants";
import { Public } from "../decorators/public.decorator";

/** Public JSON documents with no session and no `{ data }` envelope: MCP clients parse the raw RFC fields. */
@Public()
@SkipResponseEnvelope()
@Controller()
export class OAuthMetadataController {
	constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth) {}

	/**
	 * RFC 9728 Protected Resource Metadata. One authorization server, the four Wandit scopes only:
	 * offline_access belongs to the authorization server. Bearer header only: the token guard reads no DPoP.
	 */
	@Get([
		mcpRoutes.protectedResourceMetadata,
		mcpRoutes.protectedResourceMetadataRoot,
	])
	protectedResourceMetadata() {
		return {
			resource: MCP_RESOURCE_URL,
			authorization_servers: [MCP_ISSUER_URL],
			scopes_supported: [...mcpScopes],
			bearer_methods_supported: ["header"],
		};
	}

	/**
	 * RFC 8414 Authorization Server Metadata, built by the oauth-provider plugin for the issuer `<BETTER_AUTH_URL>/api/auth`.
	 * The token endpoint refuses DPoP, so the DPoP field goes out. A client that reads it would send a proof and fail.
	 */
	@Get(mcpRoutes.authorizationServerMetadata)
	async authorizationServerMetadata() {
		const { dpop_signing_alg_values_supported: _dpop, ...metadata } =
			await this.auth.api.getOAuthServerConfig();
		return metadata;
	}
}
