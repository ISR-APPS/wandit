import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { ConnectorGenerationsModule } from "../connector-generations/connector-generations.module";
import { MediaGenerationsModule } from "../media-generations/media-generations.module";
import { MeteringModule } from "../metering/metering.module";
import { HiggsfieldPromptRefinerService } from "./application/services/higgsfield-prompt-refiner.service";
import { McpChatToolsService } from "./application/services/mcp-chat-tools.service";
import { McpConnectionsService } from "./application/services/mcp-connections.service";
import { McpOauthService } from "./application/services/mcp-oauth.service";
import { McpRuntimeCacheService } from "./application/services/mcp-runtime-cache.service";
import { McpDcrClient } from "./infrastructure/oauth/mcp-dcr.client";
import { PreregOauthClient } from "./infrastructure/oauth/prereg-oauth.client";
import { McpConnectionsRepository } from "./infrastructure/persistence/mcp-connections.repository";
import { McpConnectorsRepository } from "./infrastructure/persistence/mcp-connectors.repository";
import { McpConnectorsController } from "./presentation/http/controllers/mcp-connectors.controller";

@Module({
	controllers: [McpConnectorsController],
	exports: [McpChatToolsService, McpConnectionsService],
	// MediaGenerationsModule supplies the video director: Higgsfield video
	// prompts are crafted by the SAME creative director as gateway renders.
	imports: [
		ConnectorGenerationsModule,
		DatabaseModule,
		MediaGenerationsModule,
		MeteringModule,
	],
	providers: [
		HiggsfieldPromptRefinerService,
		McpChatToolsService,
		McpConnectionsRepository,
		McpConnectionsService,
		McpConnectorsRepository,
		McpDcrClient,
		McpOauthService,
		McpRuntimeCacheService,
		PreregOauthClient,
	],
})
export class McpConnectorsModule {}
