import type { SiteStyleMap } from "@wandit/contracts";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import type { AiUsageEvent } from "../../../metering/domain/metering";
import { SITE_CAPTURE_CREDITS } from "../../../metering/domain/operation-registry";
import type { HostToolContext } from "../../domain/ports/host-tools";
import type {
	SandboxFile,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import type {
	CaptureSitePage,
	SiteCaptureOutcome,
	SitePageCapture,
} from "../../domain/ports/web-pages";
import {
	type CaptureSiteHostToolDeps,
	createCaptureSiteTool,
} from "./capture-site.host-tool";

type CaptureSiteMetering = CaptureSiteHostToolDeps["metering"];
type FetchPublicFile = CaptureSiteHostToolDeps["fetchPublicFile"];
type PublicFile = Awaited<ReturnType<FetchPublicFile>>;

const CHILD_EVENT_FIELDS: Partial<AiUsageEvent> = {
	id: "evt_child_1",
	operation: "site_capture",
	parentEventId: "evt_parent_1",
	reservedCredits: SITE_CAPTURE_CREDITS,
};
// SAFETY: the tool reads only `id` of the reserved event.
const CHILD_EVENT = CHILD_EVENT_FIELDS as AiUsageEvent;

const DESKTOP_SHOT_URL = "https://storage.example.com/desktop.png";
const MOBILE_SHOT_URL = "https://storage.example.com/mobile.png";
// The `.html` end proves that the file name takes its extension from the content type.
const HERO_URL = "https://cdn.example.com/img/hero.html?v=2";
const ACTIVE_SVG_URL = "https://cdn.example.com/img/wave.svg";
const FONT_URL = "https://cdn.example.com/fonts/inter.woff2";

const STYLE_MAP: SiteStyleMap = {
	nodes: [
		{
			h: 400,
			id: 0,
			parent: null,
			src: HERO_URL,
			style: { backgroundImage: `url("${ACTIVE_SVG_URL}")` },
			tag: "img",
			w: 1440,
			x: 0,
			y: 0,
		},
	],
	pageHeight: 1000,
	pageWidth: 1440,
};

function desktopOutcomeOf(
	fields: Partial<SitePageCapture> = {},
): SiteCaptureOutcome {
	return {
		capture: {
			brandingJson: null,
			finalUrl: "https://example.com/",
			imageUrls: [],
			markdown: "# Example",
			rawHtml: "<html><body><h1>Example</h1></body></html>",
			screenshotUrl: DESKTOP_SHOT_URL,
			styleMap: STYLE_MAP,
			title: "Example",
			...fields,
		},
		costUsdMicros: 1980,
		status: "ok",
	};
}

const MOBILE_OK: SiteCaptureOutcome = {
	capture: {
		brandingJson: null,
		finalUrl: "https://example.com/",
		imageUrls: [],
		markdown: null,
		rawHtml: null,
		screenshotUrl: MOBILE_SHOT_URL,
		styleMap: null,
		title: "Example",
	},
	costUsdMicros: 990,
	status: "ok",
};

async function pngOf(width: number, height: number): Promise<PublicFile> {
	const bytes = await sharp({
		create: { background: "#336699", channels: 3, height, width },
	})
		.png()
		.toBuffer();
	return { bytes, mediaType: "image/png", status: "ok" };
}

async function setup(
	options: {
		desktop?: SiteCaptureOutcome;
		mobile?: SiteCaptureOutcome;
		holdEventId?: string | null;
		writeFiles?: SandboxHandle["writeFiles"];
	} = {},
) {
	const publicFiles = new Map<string, PublicFile>([
		[DESKTOP_SHOT_URL, await pngOf(1440, 1000)],
		[MOBILE_SHOT_URL, await pngOf(390, 900)],
		[HERO_URL, await pngOf(40, 20)],
		[
			ACTIVE_SVG_URL,
			{
				bytes: new TextEncoder().encode(
					'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
				),
				mediaType: "image/svg+xml",
				status: "ok",
			},
		],
		[
			FONT_URL,
			{ bytes: new Uint8Array(8), mediaType: "font/woff2", status: "ok" },
		],
	]);
	const metering = {
		refund: vi.fn<CaptureSiteMetering["refund"]>(async () => CHILD_EVENT),
		reserve: vi.fn<CaptureSiteMetering["reserve"]>(async () => CHILD_EVENT),
		settle: vi.fn<CaptureSiteMetering["settle"]>(async () => CHILD_EVENT),
	};
	const captureSitePage = vi.fn<CaptureSitePage>(async ({ device }) =>
		device === "desktop"
			? (options.desktop ?? desktopOutcomeOf())
			: (options.mobile ?? MOBILE_OK),
	);
	const fetchPublicFile: FetchPublicFile = async (url) =>
		publicFiles.get(url) ?? { reason: "http_status", status: "refused" };
	const writeFiles = vi.fn<SandboxHandle["writeFiles"]>(
		options.writeFiles ?? (async () => {}),
	);
	const sandboxFields: Partial<SandboxHandle> = {
		workspaceDir: "/vercel/workspace",
		writeFiles,
	};
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		framework: "web-app",
		holdEventId:
			options.holdEventId === undefined ? "evt_parent_1" : options.holdEventId,
		knownThemeFile: () => null,
		mode: "build",
		onThemeFileWritten: () => {},
		organizationId: null,
		projectId: "project-1",
		// SAFETY: capture_site reads only `workspaceDir` and `writeFiles` of the sandbox.
		sandbox: sandboxFields as SandboxHandle,
		subject: { actorUserId: "user-1", organizationId: null },
		templateVersion: "web-app@1.1.0",
		turnId: "turn-1",
	};
	const tool = createCaptureSiteTool(
		{
			audit: { insert: vi.fn(async () => {}) },
			captureSitePage,
			fetchPublicFile,
			logger: { info: vi.fn(), warn: vi.fn() },
			metering,
		},
		context,
	);
	const execute = tool.execute;
	if (execute === undefined) {
		throw new Error("capture_site must define execute");
	}
	const capture = (url = "https://example.com/") =>
		execute({ url }, { context: {}, messages: [], toolCallId: "tc-1" });
	// The files of the one sandbox write, or an empty list when the tool wrote nothing.
	const writtenFiles = (): SandboxFile[] => writeFiles.mock.calls[0]?.[0] ?? [];
	return { capture, captureSitePage, metering, writeFiles, writtenFiles };
}

describe("createCaptureSiteTool", () => {
	it("makes no provider call when the turn has no hold", async () => {
		const { capture, captureSitePage } = await setup({ holdEventId: null });

		const output = await capture();

		expect(output).toMatchObject({ status: "failed" });
		expect(captureSitePage).not.toHaveBeenCalled();
	});

	it("refuses capture 4 of one turn with no reserve", async () => {
		const { capture, metering } = await setup();
		await capture();
		await capture();
		await capture();

		const output = await capture();

		expect(output).toMatchObject({ status: "failed" });
		expect(metering.reserve).toHaveBeenCalledTimes(3);
	});

	it.each([
		{
			name: "a desktop capture that the provider fails",
			desktop: { message: "SCRAPE_SITE_ERROR", status: "failed" } as const,
		},
		{
			name: "a capture with no page HTML",
			desktop: desktopOutcomeOf({ rawHtml: null }),
		},
	])("refunds and writes no file for $name", async ({ desktop }) => {
		const { capture, metering, writeFiles } = await setup({ desktop });

		const output = await capture();

		expect(output).toMatchObject({ status: "failed" });
		expect(metering.refund).toHaveBeenCalledTimes(1);
		expect(metering.settle).not.toHaveBeenCalled();
		expect(writeFiles).not.toHaveBeenCalled();
	});

	it("keeps the desktop capture and settles one time when the mobile capture fails", async () => {
		const { capture, metering } = await setup({
			mobile: { message: "SCRAPE_TIMEOUT", status: "failed" },
		});

		const output = await capture();

		expect(output).toMatchObject({
			desktop: {
				bandPaths: [
					"/tmp/wandit/clone/0f115db062b7c0dd/desktop/01.jpg",
					"/tmp/wandit/clone/0f115db062b7c0dd/desktop/02.jpg",
				],
				pageHeightCssPx: 1000,
			},
			mobile: null,
			status: "captured",
			warnings: [
				"No mobile capture. Build the 390 px layout from the desktop files.",
			],
		});
		expect(metering.settle).toHaveBeenCalledTimes(1);
		expect(metering.settle).toHaveBeenCalledWith(
			"evt_child_1",
			expect.objectContaining({
				costUsdMicros: 1980,
				finalCredits: SITE_CAPTURE_CREDITS,
			}),
		);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("refunds when the sandbox write throws", async () => {
		const { capture, metering } = await setup({
			writeFiles: async () => {
				throw new Error("sandbox stopped");
			},
		});

		const output = await capture();

		expect(output).toMatchObject({ status: "failed" });
		expect(metering.refund).toHaveBeenCalledTimes(1);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	// The limits of count, size, and time skip the last files of the list, so a font must be first.
	it("puts a font before the images in the download order", async () => {
		const { capture, writtenFiles } = await setup({
			desktop: desktopOutcomeOf({
				rawHtml: `<style>@font-face{font-family:Inter;src:url(${FONT_URL}) format("woff2")}</style>`,
			}),
		});

		await capture();

		const publicPaths = writtenFiles()
			.map((file) => file.path)
			.filter((path) => path.startsWith("/vercel/workspace/"));
		expect(publicPaths).toEqual([
			"/vercel/workspace/public/clone/0f115db0/01-inter.woff2",
			"/vercel/workspace/public/clone/0f115db0/02-hero.png",
		]);
	});

	it("copies an image under public/clone with a name from its content type and skips an SVG with a script", async () => {
		const { capture, writtenFiles } = await setup();

		const output = await capture();

		expect(output).toMatchObject({ assetCount: 1, skippedAssetCount: 1 });
		const publicPaths = writtenFiles()
			.map((file) => file.path)
			.filter((path) => path.startsWith("/vercel/workspace/"));
		expect(publicPaths).toEqual([
			"/vercel/workspace/public/clone/0f115db0/01-hero.png",
		]);
		const assetsJson = writtenFiles().find((file) =>
			file.path.endsWith("/assets.json"),
		)?.content;
		expect(JSON.parse(String(assetsJson))).toEqual([
			{
				bytes: expect.any(Number),
				height: 20,
				mediaType: "image/png",
				publicPath: "/clone/0f115db0/01-hero.png",
				sourceUrl: HERO_URL,
				width: 40,
			},
			{
				bytes: 0,
				mediaType: "image/svg+xml",
				publicPath: null,
				skippedReason: "active_svg",
				sourceUrl: ACTIVE_SVG_URL,
			},
		]);
	});
});
