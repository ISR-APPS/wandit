import { describe, expect, it } from "vitest";

import {
	HIGGSFIELD_CINEMA_MODEL,
	HIGGSFIELD_EDIT_MODEL,
	HIGGSFIELD_MARKETING_MODEL,
	HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
} from "../../mcp-connectors/domain/higgsfield-models";
import { WANDIT_SYSTEM_PROMPT } from "./system-prompt";

describe("COD SKU laws in the chat system prompt", () => {
	it("collects and preserves a merchant-provided SKU before building", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			'make ONE dedicated ask_user call with kind "free-text" and zero options',
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"Never invent, translate, normalize, or reformat a SKU",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"any short internal product code they want to see on their orders",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"the exact product SKU must appear verbatim in OFFER and/or here",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"AND productSku with the user's exact value",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			'If it answers "needs-input", do what its message says',
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"then retry generate_page after they respond",
		);
	});
});

describe("video laws in the chat system prompt", () => {
	it("exports every preferred connected-road model id", () => {
		for (const modelId of [
			HIGGSFIELD_CINEMA_MODEL,
			HIGGSFIELD_EDIT_MODEL,
			HIGGSFIELD_MARKETING_MODEL,
			HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
		]) {
			expect(modelId.length).toBeGreaterThan(0);
		}
	});

	it("makes bodiless narration a native max-tier capability", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"Standard is the default-capability renderer: one continuous shot, at most 10 seconds, no person speaking on camera, and no narration.",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"the user wants voiceover narration with nobody speaking on screen",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			'bodiless narration ALWAYS means quality: "max" and talking: false',
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"the max renderer lays that exact script over the clip as native narration",
		);
		expect(WANDIT_SYSTEM_PROMPT).not.toContain("upcoming narration feature");
	});

	it("requires honest same-length edit warnings and one edit call", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain("## Editing a video");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"the edited clip keeps the same length and framing",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"the whole clip is re-rendered so tiny details can shift",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain("editing may not preserve lip-sync");
		expect(WANDIT_SYSTEM_PROMPT).toContain("call edit_video exactly ONCE");
	});

	it("caps extension chains and records the join and narration warnings", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain("## Making a video longer");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"Each added piece is either 5 or 10 seconds",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"at most three additions TOTAL over its whole extension chain",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"fast motion can stutter at the joins",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"lip-sync breaks across chained frames",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"roughly 2.4 words per second of total duration",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"extending it without a new full-length voiceover would remove that narration",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain("pass acceptSilent: true");
		expect(WANDIT_SYSTEM_PROMPT).toContain("Call extend_video exactly ONCE");
	});

	it("routes connected Higgsfield studios from the user's wish", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			`A wish to sell or promote a product uses generate_video with model ${HIGGSFIELD_MARKETING_MODEL}`,
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			`A cinematic film wish uses generate_video with model ${HIGGSFIELD_CINEMA_MODEL}`,
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			`A simple clip wish uses generate_video with the general default model ${HIGGSFIELD_EDIT_MODEL}`,
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain("action='fetch'");
		expect(WANDIT_SYSTEM_PROMPT).toContain("action='create'");
		expect(WANDIT_SYSTEM_PROMPT).toContain("action='presets'");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"Marketing defaults to 16:9, so pass 9:16 explicitly for TikTok or Reels",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"I'll make this in Higgsfield's Marketing Studio",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain('say "DTC Ads", never ms_image');
	});

	it("keeps Marketing Studio inside its supported duration range", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"Marketing Studio supports ONLY 12–15-second videos.",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"warn plainly that Marketing Studio cannot make a clip that short",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"confirm a 12–15-second Marketing Studio ad, or explicitly switch the WHOLE video to Wandit's own generator",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"On Wandit's own road, offer 5, 10, or 15 seconds",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"On the connected Higgsfield road, offer only durations supported by the chosen studio or model",
		);
	});

	it("asks one wish-question and analyzes reference videos before routing", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			'ask exactly ONE wish-question through ask_user, such as "an ad that sells, or a cinematic film?"',
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			'For a reference-video wish such as "make one like this video", call video_analysis_create first',
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"EXACTLY ONE input: video_input_id set to the media_id returned by media_import_url, or youtube_url",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain("analysis takes 3–5 minutes");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"longer videos analyze less accurately",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"use video_analysis_status, never job_status",
		);
	});

	it("defines surgical connected edits with the preferred edit model", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain("HIGGSFIELD CONNECTED EDIT");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			`uses generate_video with model ${HIGGSFIELD_EDIT_MODEL}`,
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain('role "video_references"');
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			'In the generate_video params, you MUST pass mode: "video_edit".',
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain('"change X, keep everything else"');
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"the edited clip keeps the same length and framing while the whole clip is re-rendered",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"the edit may not preserve lip-sync",
		);
	});

	it("keeps connected provider credit economics internal", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"get_cost results and credit economics from provider descriptions are INTERNAL",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"NEVER state any credit number from them to the user",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"describe relative cost in qualitative terms only",
		);
	});

	it("keeps connected narration inside Higgsfield", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"HIGGSFIELD CONNECTED NARRATION — make narration inside Higgsfield",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain("Prefer ONE render pass");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"supply talking, voiceoverLanguage, and voiceoverScript",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain("generate_audio is SPEECH ONLY");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"NEVER promise Wandit's own TTS or mux for connected output",
		);
	});

	it("allows connector file forwarding within Higgsfield's import contract", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"image, video, and music attachments go through media_import_url",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain("Higgsfield caps imports at 50 MB");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			`role "audio" on model ${HIGGSFIELD_EDIT_MODEL}`,
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"Every medias[].value is a media_id or job_id, never a URL",
		);
	});

	it("requires an explicit opt-in before switching away from Higgsfield", () => {
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"OFFER through ask_user to make the WHOLE video with Wandit's own generator instead",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"Proceed only after the user's explicit yes",
		);
		expect(WANDIT_SYSTEM_PROMPT).toContain("Never switch roads silently");
		expect(WANDIT_SYSTEM_PROMPT).toContain(
			"never mix roads inside one deliverable unless the user asks",
		);
	});
});
