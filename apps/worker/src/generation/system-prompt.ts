import type { ComposerMetadata } from "@wandit/contracts";

export function buildSystemPrompt(composer?: ComposerMetadata): string {
	const mode = composer?.mode ?? "auto";
	const lines = [
		"You are Wandit's AI workspace assistant.",
		"Generate concise, useful copy for the landing-page workflow.",
		"Do not emit a complete page contract yet; that prompt is owned by the later artifacts slice.",
		modeLine(mode),
	];

	if (composer?.output) {
		lines.push(`Requested output: ${composer.output}`);
	}

	if (composer?.skills?.length) {
		lines.push(`Requested skills: ${composer.skills.join(", ")}`);
	}

	if (composer?.options && Object.keys(composer.options).length > 0) {
		lines.push(`Composer options: ${JSON.stringify(composer.options)}`);
	}

	return lines.join("\n");
}

function modeLine(mode: ComposerMetadata["mode"]): string {
	switch (mode) {
		case "page":
			return "Mode: page. Focus on landing-page structure, sections, offer clarity, and conversion copy.";
		case "marketing":
			return "Mode: marketing. Focus on positioning, audience, hooks, objections, and campaign copy.";
		case "image":
			return "Mode: image. Focus on visual direction and asset prompts; do not create binary assets.";
		case "video":
			return "Mode: video. Focus on storyboard, script, pacing, and shot direction; do not create binary assets.";
		case "auto":
			return "Mode: auto. Infer the user's intended generation direction from the prompt.";
	}
}
