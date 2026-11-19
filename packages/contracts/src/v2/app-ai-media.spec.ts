import { describe, expect, it } from "vitest";
import { appAiVideoRequestSchema } from "./app-ai-media";

describe("appAiVideoRequestSchema", () => {
	// Money: seconds and resolution set the video price, and an audio flag
	// the model ignores makes an upstream warning. A value the model does not
	// take must not reach the quote.
	it.each([
		{
			model: "bytedance/seedance-2.5-flash",
			seconds: 5,
			resolution: "1080p",
			audio: false,
			accepted: false,
		},
		{
			model: "heygen/heygen-video-1",
			seconds: 15,
			resolution: "480p",
			audio: false,
			accepted: false,
		},
		{
			model: "heygen/heygen-video-1",
			seconds: 14,
			resolution: "2k",
			audio: false,
			accepted: true,
		},
		{
			model: "heygen/heygen-video-1",
			seconds: 5,
			resolution: "480p",
			audio: true,
			accepted: false,
		},
		{
			model: "bytedance/seedance-2.5",
			seconds: 15,
			resolution: "1080p",
			audio: true,
			accepted: true,
		},
		{
			model: "bytedance/seedance-2.5",
			seconds: 16,
			resolution: "1080p",
			audio: false,
			accepted: false,
		},
		{
			model: "minimax/minimax-h3-max",
			seconds: 5,
			resolution: "720p",
			audio: false,
			accepted: false,
		},
	])("$model with $seconds s at $resolution and audio $audio: accepted $accepted", ({
		model,
		seconds,
		resolution,
		audio,
		accepted,
	}) => {
		const result = appAiVideoRequestSchema.safeParse({
			model,
			prompt: "A red kite over the sea.",
			seconds,
			resolution,
			audio,
		});
		expect(result.success).toBe(accepted);
	});

	// Money: BytePlus reads `--rs` and `--dur` in a Seedance prompt, so the
	// prompt could ask for a longer and larger video than the hold pays.
	it.each([
		["bytedance/seedance-2.5", false],
		["heygen/heygen-video-1", true],
	])("%s with -- flags in the prompt: accepted %s", (model, accepted) => {
		const result = appAiVideoRequestSchema.safeParse({
			model,
			prompt: "A cat --rs 1080p --dur 30",
			seconds: 5,
		});
		expect(result.success).toBe(accepted);
	});
});
