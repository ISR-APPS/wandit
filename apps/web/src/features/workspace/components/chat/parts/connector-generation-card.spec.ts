import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ConnectorGenerationCard } from "./connector-generation-card";

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			const value =
				(
					{
						"workspace.chat.mcpTool.generation.clipperLongJobHint":
							"Clipping a long video can take 10–30 minutes.",
						"workspace.chat.mcpTool.generation.sentTo": "Sent to {connector}",
						"workspace.chat.mcpTool.generation.statusGenerating": "Generating",
						"workspace.chat.mcpTool.generation.statusQueued": "Queued",
						"workspace.chat.mcpTool.generation.usually": "usually 2–4 min",
						"workspace.chat.mcpTool.generation.workingHint":
							"{connector} is on it.",
					} as Record<string, string>
				)[key] ?? key;

			return value.replace(/\{(\w+)\}/g, (_, name: string) =>
				String(params?.[name] ?? `{${name}}`),
			);
		},
	}),
}));

vi.mock("../../../api/connector-generations.queries", () => ({
	connectorGenerationKeys: {
		attempt: (attemptId: string) => ["connector-generation", attemptId],
	},
	useConnectorGenerationAttemptQuery: () => ({
		data: {
			createdAt: "2026-08-24T10:00:00.000Z",
			id: "attempt-1",
			media: [],
			status: "running",
		},
		error: null,
	}),
}));

vi.mock("../../../lib/use-live-run", () => ({
	useLiveRun: () => ({
		failed: false,
		metadata: { stage: "rendering" },
		status: "EXECUTING",
	}),
}));

vi.mock("react-timer-hook", () => ({
	useStopwatch: () => ({ hours: 0, minutes: 1, seconds: 2 }),
}));

describe("ConnectorGenerationCard", () => {
	function renderCard(toolName: string): string {
		return renderToStaticMarkup(
			createElement(ConnectorGenerationCard, {
				args: {},
				attemptId: "attempt-1",
				connectorName: "Higgsfield",
				realtime: undefined,
				title: "Generating video",
				toolName,
			}),
		);
	}

	it("shows the long-job hint only for a running Personal Clipper job", () => {
		const clipper = renderCard("personal_clipper_create");
		const video = renderCard("generate_video");

		expect(clipper).toContain("Clipping a long video can take 10–30 minutes.");
		expect(clipper).not.toContain("usually 2–4 min");
		expect(video).not.toContain(
			"Clipping a long video can take 10–30 minutes.",
		);
		expect(video).toContain("usually 2–4 min");
	});
});
