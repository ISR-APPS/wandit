import { createDb } from "@wandit/db";
import { mcpConnectors } from "@wandit/db/schema/mcp-connectors";

const MCP_CONNECTOR_SEEDS = [
	{
		authKind: "mcp_dcr",
		authorizationUrl: null,
		description: "Connect TikTok Ads to manage campaigns and performance.",
		iconUrl: "https://www.tiktok.com/favicon.ico",
		mcpServerUrl: "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer",
		name: "TikTok Ads",
		scopes: null,
		slug: "tiktok-ads",
		sortOrder: 0,
		tokenUrl: null,
	},
	{
		authKind: "oauth_prereg",
		authorizationUrl: "https://www.facebook.com/v25.0/dialog/oauth",
		description: "Connect Meta Ads to manage campaigns and performance.",
		iconUrl: "https://www.facebook.com/images/icons/meta_icon.png",
		mcpServerUrl: "https://mcp.facebook.com/ads",
		name: "Meta Ads",
		scopes: "ads_management,ads_read,ads_mcp_management,business_management",
		slug: "meta-ads",
		sortOrder: 1,
		tokenUrl: "https://graph.facebook.com/v25.0/oauth/access_token",
	},
	{
		authKind: "mcp_dcr",
		authorizationUrl: null,
		description: "Connect Higgsfield to generate images and videos.",
		iconUrl: "https://higgsfield.ai/favicon.ico",
		mcpServerUrl: "https://mcp.higgsfield.ai/mcp",
		name: "Higgsfield",
		scopes: null,
		slug: "higgsfield",
		sortOrder: 2,
		tokenUrl: null,
	},
] as const;

async function main() {
	const db = createDb();

	try {
		for (const connector of MCP_CONNECTOR_SEEDS) {
			await db
				.insert(mcpConnectors)
				.values(connector)
				.onConflictDoUpdate({
					set: {
						authKind: connector.authKind,
						authorizationUrl: connector.authorizationUrl,
						description: connector.description,
						iconUrl: connector.iconUrl,
						mcpServerUrl: connector.mcpServerUrl,
						name: connector.name,
						scopes: connector.scopes,
						sortOrder: connector.sortOrder,
						tokenUrl: connector.tokenUrl,
					},
					target: mcpConnectors.slug,
				});
		}

		const rows = await db
			.select({
				enabled: mcpConnectors.enabled,
				name: mcpConnectors.name,
				slug: mcpConnectors.slug,
				sortOrder: mcpConnectors.sortOrder,
			})
			.from(mcpConnectors)
			.orderBy(mcpConnectors.sortOrder);

		console.table(rows);
		console.log(`MCP connector catalog contains ${rows.length} rows.`);
	} finally {
		await db.$client.end();
	}
}

await main();
