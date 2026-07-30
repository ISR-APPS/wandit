import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
	collapseMcpActivityRows,
	humanizeMcpToolLabel,
	McpActivityCard,
	mcpRunHasDeliverables,
} from "./mcp-tool-part";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			const value =
				(
					{
						"workspace.chat.mcpTool.approve": "Approve",
						"workspace.chat.mcpTool.approved": "Approved",
						"workspace.chat.mcpTool.actionCount": "{count} actions",
						"workspace.chat.mcpTool.usedTool": "Used 1 tool",
						"workspace.chat.mcpTool.usedTools": "Used {count} tools",
						"workspace.chat.mcpTool.progressOf": "{done} of {total}",
						"workspace.chat.mcpTool.interrupted": "Interrupted",
						"workspace.chat.mcpTool.arguments": "Arguments",
						"workspace.chat.mcpTool.denied": "Denied",
						"workspace.chat.mcpTool.deny": "Deny",
						"workspace.chat.mcpTool.error": "Error",
						"workspace.chat.mcpTool.expired": "Approval expired",
						"workspace.chat.mcpTool.hideDetails": "Hide details",
						"workspace.chat.mcpTool.result": "Result",
						"workspace.chat.mcpTool.readingToolDetails": "Reading tool details",
						"workspace.chat.mcpTool.readToolDetails": "Read tool details",
						"workspace.chat.mcpTool.searchedToolCatalog":
							"Searched the tool catalog",
						"workspace.chat.mcpTool.searchingToolCatalog":
							"Searching the tool catalog",
						"workspace.chat.mcpTool.showDetails": "Show details",
						"workspace.chat.mcpTool.skippedDeclined": "Skipped — you declined",
						"workspace.chat.mcpTool.stepFailed": "This step failed",
						"workspace.chat.mcpTool.waiting": "Waiting to continue…",
						"workspace.chat.mcpTool.wantsTo":
							"Wandit wants to: {action} · {connector}",
						"workspace.chat.mcpTool.workingWith": "Working with your tools",
					} as Record<string, string>
				)[key] ?? key;

			return value.replace(/\{(\w+)\}/g, (_, name: string) =>
				String(params?.[name] ?? `{${name}}`),
			);
		},
	}),
	useDictionary: () => ({
		workspace: {
			chat: {
				mcpTool: {
					toolLabels: {
						campaign_create: {
							active: "Creating campaign",
							past: "Created campaign",
						},
						ads_create_campaign: {
							active: "Creating an ads campaign",
							past: "Ads campaign created",
						},
					},
					genericLabels: {
						fetch: { active: "Fetching data", past: "Fetched data" },
						create: { active: "Creating", past: "Created" },
						update: { active: "Updating", past: "Updated" },
						delete: { active: "Deleting", past: "Deleted" },
						publish: { active: "Publishing", past: "Published" },
						send: { active: "Sending", past: "Sent" },
						generate: { active: "Generating", past: "Generated" },
						other: {
							active: "Running an action",
							past: "Action completed",
						},
					},
				},
			},
		},
	}),
}));

type McpPart = ComponentProps<typeof McpActivityCard>["parts"][number];

const approvalPart = {
	type: "dynamic-tool",
	toolName: "mcp_meta-ads_campaign_create",
	toolCallId: "tool-call-1",
	title: "Preview <strong>report</strong>",
	state: "approval-requested",
	input: { projectId: "project-1", targeting: { country: "DZ" } },
	approval: { id: "approval-1" },
} satisfies McpPart;

function renderActivity(
	parts: McpPart[],
	isApprovalActionable = true,
	section?: "all" | "receipt" | "deliverables",
	isTurnLive = false,
	isRunConcluded = false,
): string {
	return renderToStaticMarkup(
		createElement(McpActivityCard, {
			parts,
			isApprovalActionable,
			onToolApprovalResponse: () => {},
			section,
			isTurnLive,
			isRunConcluded,
		}),
	);
}

describe("humanizeMcpToolLabel", () => {
	const t = (key: string) =>
		(
			({
				"workspace.chat.mcpTool.readingToolDetails":
					"Lecture des détails de l’outil",
				"workspace.chat.mcpTool.readToolDetails":
					"Détails de l’outil consultés",
			}) as Record<string, string>
		)[key] ?? key;
	const toolLabels = {
		report_integrated_get: {
			active: "Récupération du rapport",
			past: "Rapport récupéré",
		},
		campaign_create: {
			active: "Création de la campagne",
			past: "Campagne créée",
		},
		campaign_get: {
			active: "Lecture de la campagne",
			past: "Campagne consultée",
		},
	};
	const genericLabels = {
		fetch: {
			active: "Lecture des données",
			past: "Données consultées",
		},
		create: {
			active: "Création",
			past: "Création effectuée",
		},
		update: {
			active: "Modification",
			past: "Modification effectuée",
		},
		delete: {
			active: "Suppression",
			past: "Suppression effectuée",
		},
		publish: {
			active: "Publication",
			past: "Publication effectuée",
		},
		send: {
			active: "Envoi",
			past: "Envoi effectué",
		},
		generate: {
			active: "Génération",
			past: "Génération effectuée",
		},
		other: {
			active: "Action sur la plateforme",
			past: "Action effectuée",
		},
	};

	it("uses localized labels for a known operation in both modes", () => {
		expect(
			humanizeMcpToolLabel(
				"mcp_tiktok-ads_report_integrated_get",
				undefined,
				"active",
				t,
				toolLabels,
			),
		).toBe("Récupération du rapport");
		expect(
			humanizeMcpToolLabel(
				"mcp_tiktok-ads_report_integrated_get",
				undefined,
				"past",
				t,
				toolLabels,
			),
		).toBe("Rapport récupéré");
	});

	it("uses localized generic fetch labels for an unknown operation", () => {
		expect(
			humanizeMcpToolLabel(
				"mcp_tiktok-ads_weird_thing_get",
				undefined,
				"active",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Lecture des données");
		expect(
			humanizeMcpToolLabel(
				"mcp_tiktok-ads_weird_thing_get",
				undefined,
				"past",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Données consultées");
	});

	it("uses localized generic create labels for an unknown operation", () => {
		expect(
			humanizeMcpToolLabel(
				"mcp_meta-ads_widget_create",
				undefined,
				"active",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Création");
		expect(
			humanizeMcpToolLabel(
				"mcp_meta-ads_widget_create",
				undefined,
				"past",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Création effectuée");
	});

	it("moves a suffix verb to the front", () => {
		expect(
			humanizeMcpToolLabel("mcp_tiktok-ads_advertiser_info_get", undefined),
		).toBe("Getting advertiser info");
	});

	it("uses the nested operation for a generic tool_execute wrapper", () => {
		expect(
			humanizeMcpToolLabel("mcp_tiktok-ads_tool_execute", {
				tool_name: "campaign_create",
				params: {},
			}),
		).toBe("Creating campaign");
	});

	it("uses a localized nested read operation for tool_execute", () => {
		expect(
			humanizeMcpToolLabel(
				"mcp_tiktok-ads_tool_execute",
				{
					tool_name: "campaign_get",
					params: {},
				},
				"active",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Lecture de la campagne");
		expect(
			humanizeMcpToolLabel(
				"mcp_tiktok-ads_tool_execute",
				{
					tool_name: "campaign_get",
					params: {},
				},
				"past",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Campagne consultée");
	});

	it("labels catalog searches without exposing the query", () => {
		expect(humanizeMcpToolLabel("search_platform_tools", {})).toBe(
			"Searching the tool catalog",
		);
		expect(humanizeMcpToolLabel("search_platform_tools", {}, "past")).toBe(
			"Searched the tool catalog",
		);
		expect(
			humanizeMcpToolLabel("search_platform_tools", {
				query: "campaign reporting",
			}),
		).toBe("Searching the tool catalog");
		expect(
			humanizeMcpToolLabel("search_platform_tools", {
				query: "a".repeat(41),
			}),
		).toBe("Searching the tool catalog");
	});

	it("keeps English nested labels for tool descriptions without maps", () => {
		expect(humanizeMcpToolLabel("describe_platform_tool", {})).toBe(
			"Reading tool details",
		);
		expect(humanizeMcpToolLabel("describe_platform_tool", {}, "past")).toBe(
			"Read tool details",
		);
		expect(
			humanizeMcpToolLabel("describe_platform_tool", {
				tool_name: "campaign_create",
			}),
		).toBe("Reading tool details · Creating campaign");
		expect(
			humanizeMcpToolLabel(
				"describe_platform_tool",
				{ tool_name: "campaign_create" },
				"past",
			),
		).toBe("Read tool details · Created campaign");
	});

	it("appends a localized nested label to tool descriptions on a dictionary hit", () => {
		expect(
			humanizeMcpToolLabel(
				"describe_platform_tool",
				{ tool_name: "campaign_create" },
				"active",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Lecture des détails de l’outil · Création de la campagne");
		expect(
			humanizeMcpToolLabel(
				"describe_platform_tool",
				{ tool_name: "campaign_create" },
				"past",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Détails de l’outil consultés · Campagne créée");
	});

	it("omits the nested label from localized tool descriptions on a miss", () => {
		expect(
			humanizeMcpToolLabel(
				"describe_platform_tool",
				{ tool_name: "weird_thing_get" },
				"active",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Lecture des détails de l’outil");
		expect(
			humanizeMcpToolLabel(
				"describe_platform_tool",
				{ tool_name: "weird_thing_get" },
				"past",
				t,
				toolLabels,
				genericLabels,
			),
		).toBe("Détails de l’outil consultés");
	});

	it("uses the nested operation for run_platform_tool", () => {
		expect(humanizeMcpToolLabel("run_platform_tool", {})).toBe("Run Platform");
		expect(
			humanizeMcpToolLabel("run_platform_tool", {
				connector: "meta-ads",
				tool_name: "campaign_create",
				params: {},
			}),
		).toBe("Creating campaign");
		expect(
			humanizeMcpToolLabel(
				"run_platform_tool",
				{
					connector: "meta-ads",
					tool_name: "campaign_create",
					params: {},
				},
				"past",
			),
		).toBe("Created campaign");
	});

	it("title-cases an operation with no known verb", () => {
		expect(humanizeMcpToolLabel("mcp_meta-ads_frobnicate_widget", {})).toBe(
			"Frobnicate Widget",
		);
	});
});

describe("McpActivityCard", () => {
	it("renders a humanized approval with actionable controls", () => {
		const html = renderActivity([approvalPart]);

		expect(html).toContain("Creating campaign");
		expect(html).toContain("Wandit wants to: Creating campaign · Meta Ads");
		expect(html).toContain("Project Id");
		expect(html).toContain(">Approve</button>");
		expect(html).toContain(">Deny</button>");
	});

	it("uses the inner run_platform_tool action and connector for approval", () => {
		const html = renderActivity([
			{
				...approvalPart,
				toolName: "run_platform_tool",
				input: {
					connector: "meta-ads",
					tool_name: "campaign_create",
					params: {},
				},
			},
		]);

		expect(html).toContain("Creating campaign");
		expect(html).toContain("Wandit wants to: Creating campaign · Meta Ads");
		expect(html).not.toContain("Run Platform");
	});

	it("shows only nested run_platform_tool arguments in approvals", () => {
		const html = renderActivity([
			{
				...approvalPart,
				toolName: "run_platform_tool",
				input: {
					connector: "meta-ads",
					tool_name: "ads_create_campaign",
					params: {
						objective: "SALES",
						budget: 50,
					},
				},
			},
		]);
		const argumentsMarkup = html.match(/<ul[^>]*>.*?<\/ul>/su)?.[0];

		expect(html).toContain(
			"Wandit wants to: Creating an ads campaign · Meta Ads",
		);
		expect(argumentsMarkup).toBeDefined();
		expect(argumentsMarkup).toContain(">Objective</span>");
		expect(argumentsMarkup).toContain(">SALES</span>");
		expect(argumentsMarkup).toContain(">Budget</span>");
		expect(argumentsMarkup).toContain(">50</span>");
		expect(argumentsMarkup).not.toContain(">Connector</span>");
		expect(argumentsMarkup).not.toContain(">Tool Name</span>");
		expect(argumentsMarkup).not.toContain(">Params</span>");
		expect(argumentsMarkup).not.toContain("meta-ads");
		expect(argumentsMarkup).not.toContain("ads_create_campaign");
	});

	it("keeps historical approvals expired and non-actionable", () => {
		const html = renderActivity(
			[
				approvalPart,
				{
					type: "dynamic-tool",
					toolName: "mcp_meta-ads_report_get",
					toolCallId: "tool-call-running",
					state: "input-available",
					input: {},
				} satisfies McpPart,
			],
			false,
		);

		expect(html).toContain("Approval expired");
		expect(html).not.toContain(">Approve</button>");
		expect(html).not.toContain(">Deny</button>");
	});

	it("collapses consecutive rows and folds a settled run into the pill", () => {
		const completedParts = ["tool-call-1", "tool-call-2"].map(
			(toolCallId) =>
				({
					type: "dynamic-tool",
					toolName: "mcp_tiktok-ads_advertiser_info_get",
					toolCallId,
					state: "output-available",
					input: {},
					output: { ok: true },
				}) satisfies McpPart,
		);

		const rows = collapseMcpActivityRows(completedParts);
		const html = renderActivity(completedParts);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.parts).toHaveLength(2);
		expect(rows[0]?.label).toBe("Got advertiser info");
		// Settled run renders as the collapsed one-line receipt pill.
		expect(html).toContain("Used 2 tools");
		expect(html).toContain("TikTok Ads");
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain("× 2");
		// Settled shape: the quiet start-aligned chip (sources-footer style),
		// not the full-width live bar.
		expect(html).toMatch(
			/aria-expanded="false"[^>]*class="[^"]*\bself-start\b/,
		);
		// Space-delimited so "max-w-full" (allowed on the chip) does not match.
		expect(html).not.toMatch(/aria-expanded="false"[^>]*class="[^"]* w-full /);
		// Mini-avatars: code badge + the TikTok monogram stacked on it.
		expect(html).toContain(">TT<");
	});

	it("conceals a concluded receipt mid-stream and reveals it once the turn ends", () => {
		const settledPart = {
			type: "dynamic-tool",
			toolName: "mcp_tiktok-ads_advertiser_info_get",
			toolCallId: "tool-call-concluded",
			state: "output-available",
			input: {},
			output: { ok: true },
		} satisfies McpPart;

		// Turn still streaming + prose already flowing under the run: hidden.
		const midStream = renderActivity(
			[settledPart],
			true,
			undefined,
			true,
			true,
		);
		expect(midStream).toMatch(/class="[^"]*max-h-0[^"]*"[^>]*aria-hidden/);

		// Turn ended: the chip is back (revealed, interactive).
		const done = renderActivity([settledPart], true, undefined, false, true);
		expect(done).not.toContain("max-h-0");
		expect(done).toContain('aria-expanded="false"');

		// An approval waiting for the user is never concealed.
		const withApproval = renderActivity(
			[approvalPart],
			true,
			undefined,
			true,
			true,
		);
		expect(withApproval).not.toContain("max-h-0");
	});

	it("does not expose completed tool input or output in the pill", () => {
		const html = renderActivity([
			{
				type: "dynamic-tool",
				toolName: "mcp_tiktok-ads_advertiser_info_get",
				toolCallId: "tool-call-completed",
				state: "output-available",
				input: { marker: "distinctive-raw-input-value" },
				output: { marker: "distinctive-raw-output-value" },
			},
		]);

		expect(html).not.toContain("distinctive-raw-input-value");
		expect(html).not.toContain("distinctive-raw-output-value");
		// A lone finished tool labels the pill with its past action.
		expect(html).toContain("Fetched data");
	});

	it("renders the live panel with a progress count while a tool runs", () => {
		const html = renderActivity(
			[
				{
					type: "dynamic-tool",
					toolName: "mcp_tiktok-ads_advertiser_info_get",
					toolCallId: "tool-call-done",
					state: "output-available",
					input: {},
					output: { ok: true },
				},
				{
					type: "dynamic-tool",
					toolName: "mcp_tiktok-ads_campaign_get_list",
					toolCallId: "tool-call-live",
					state: "input-available",
					input: {},
				},
			],
			true,
			undefined,
			true,
		);

		expect(html).toContain("Working with your tools");
		expect(html).toContain("1 of 2");
		// Live rail + open panel; the rail sits UNDER the header and ABOVE the
		// rows (mockup 14b).
		expect(html).toContain("bg-gradient-ember");
		expect(html).toContain('aria-expanded="true"');
		expect(html.indexOf("Working with your tools")).toBeLessThan(
			html.indexOf("bg-gradient-ember"),
		);
		expect(html.indexOf("bg-gradient-ember")).toBeLessThan(
			html.indexOf("Fetched data"),
		);
	});

	it("holds the panel live through an approval handshake, never 'Interrupted'", () => {
		// Approve clicked, reply auto-resubmitting: the turn is NOT streaming
		// but the run is mid-handshake — the panel must stay open and the row
		// must keep the approved copy.
		const html = renderActivity(
			[
				{
					type: "dynamic-tool",
					toolName: "mcp_meta-ads_campaign_create",
					toolCallId: "tool-call-responded",
					state: "approval-responded",
					input: {},
					approval: { id: "approval-1", approved: true },
				},
			],
			true,
			undefined,
			false,
		);

		expect(html).toContain('aria-expanded="true"');
		expect(html).toContain("Approved");
		expect(html).not.toContain("Interrupted");
	});

	it("settles a stranded approval response in old history as interrupted", () => {
		const html = renderActivity(
			[
				{
					type: "dynamic-tool",
					toolName: "mcp_meta-ads_campaign_create",
					toolCallId: "tool-call-stranded-response",
					state: "approval-responded",
					input: {},
					approval: { id: "approval-1", approved: true },
				},
			],
			false,
			undefined,
			false,
		);

		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain("Interrupted");
	});

	it("renders stranded mid-flight history as an interrupted pill, not a spinner", () => {
		const html = renderActivity([
			{
				type: "dynamic-tool",
				toolName: "mcp_tiktok-ads_campaign_get_list",
				toolCallId: "tool-call-stranded",
				state: "input-available",
				input: {},
			},
		]);

		// Turn is not live (default): no running panel, no live rail.
		expect(html).toContain("Interrupted");
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain("bg-gradient-ember");
	});

	it("does not claim tool usage when the only call was declined", () => {
		const html = renderActivity([
			{
				type: "dynamic-tool",
				toolName: "mcp_meta-ads_campaign_create",
				toolCallId: "tool-call-denied",
				state: "output-denied",
				input: {},
				approval: { id: "approval-denied-1", approved: false },
			},
		]);

		expect(html).toContain("Skipped — you declined");
		expect(html).not.toContain("Used 1 tool");
	});
});

describe("McpActivityCard sections", () => {
	const mediaPart = {
		type: "dynamic-tool",
		toolName: "mcp_higgsfield_generate_image",
		toolCallId: "generate-media",
		state: "output-available",
		input: {},
		output: { image: "https://cdn.example.com/out.png" },
	} satisfies McpPart;

	it("renders only rows in the receipt section and only media in deliverables", () => {
		const receipt = renderActivity([mediaPart], true, "receipt");
		const deliverables = renderActivity([mediaPart], true, "deliverables");

		expect(receipt).not.toContain("https://cdn.example.com/out.png");
		expect(deliverables).toContain("https://cdn.example.com/out.png");
		expect(deliverables).not.toContain("aria-expanded");
	});

	it("detects deliverables from media outputs but not from plain results", () => {
		expect(mcpRunHasDeliverables([mediaPart])).toBe(true);
		expect(
			mcpRunHasDeliverables([
				{
					type: "dynamic-tool",
					toolName: "mcp_tiktok-ads_advertiser_info_get",
					toolCallId: "plain",
					state: "output-available",
					input: {},
					output: { ok: true },
				} satisfies McpPart,
			]),
		).toBe(false);
		// Echoed import media is not a deliverable.
		expect(
			mcpRunHasDeliverables([
				{
					type: "dynamic-tool",
					toolName: "mcp_higgsfield_media_import_url",
					toolCallId: "echo",
					state: "output-available",
					input: {},
					output: { url: "https://cdn.example.com/source.png" },
				} satisfies McpPart,
			]),
		).toBe(false);
		// A queued background generation is a deliverable (live card).
		expect(
			mcpRunHasDeliverables([
				{
					type: "dynamic-tool",
					toolName: "mcp_higgsfield_generate_video",
					toolCallId: "bg-gen",
					state: "output-available",
					input: {},
					output: {
						attemptId: "6b1f8f09-0000-4000-8000-000000000000",
						connector: "higgsfield",
						kind: "wandit_background_generation",
						note: "Queued.",
						status: "queued",
						tool: "generate_video",
					},
				} satisfies McpPart,
			]),
		).toBe(true);
	});
});

describe("McpActivityCard media previews", () => {
	function completedPart(
		toolName: string,
		toolCallId: string,
		output: unknown,
		input: unknown = {},
	): McpPart {
		return {
			type: "dynamic-tool",
			toolName,
			toolCallId,
			state: "output-available",
			input,
			output,
		} satisfies McpPart;
	}

	it("previews generated media but never imported/uploaded media", () => {
		const html = renderActivity([
			completedPart("mcp_higgsfield_media_import_url", "import-1", {
				url: "https://cdn.example.com/source-photo.png",
			}),
			completedPart("mcp_higgsfield_generate_video", "generate-1", {
				result: "https://cdn.example.com/final-video.mp4",
			}),
		]);

		expect(html).toContain("https://cdn.example.com/final-video.mp4");
		expect(html).not.toContain("https://cdn.example.com/source-photo.png");
	});

	it("hides media echoed by a wrapped import tool", () => {
		const html = renderActivity([
			completedPart(
				"run_platform_tool",
				"wrapped-import-1",
				{ url: "https://cdn.example.com/imported.jpg" },
				{ connector: "higgsfield", tool_name: "media_import_url", params: {} },
			),
		]);

		expect(html).not.toContain("https://cdn.example.com/imported.jpg");
	});

	it("renders one capped block for a single image and a filmstrip for several", () => {
		const single = renderActivity([
			completedPart("mcp_higgsfield_generate_image", "generate-2", {
				image: "https://cdn.example.com/one.png",
			}),
		]);
		expect(single).toContain("https://cdn.example.com/one.png");
		expect(single).toContain("max-h-80");
		expect(single).not.toContain("overflow-x-auto");

		const strip = renderActivity([
			completedPart("mcp_higgsfield_generate_image", "generate-3", {
				images: [
					"https://cdn.example.com/a.png",
					"https://cdn.example.com/b.png",
				],
			}),
		]);
		expect(strip).toContain("https://cdn.example.com/a.png");
		expect(strip).toContain("https://cdn.example.com/b.png");
		expect(strip).toContain("overflow-x-auto");
	});
});
