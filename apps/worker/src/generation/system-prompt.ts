// Builds the system prompt for AI chat generation.
//
// User messages are the conversation. This system prompt is the instruction
// that tells the model how it should behave for Wandit.
//
// For now, this worker generates chat/copy text only. It does not generate the
// final HTML page artifact yet.
import type { ComposerMetadata } from "@wandit/contracts";

// Return the instruction string passed to the AI SDK as `system`.
export function buildSystemPrompt(composer?: ComposerMetadata): string {
	const mode = composer?.mode ?? "auto";
	// Base rules for every chat request.
	const lines = [
		"You are Wandit's AI workspace assistant.",
		"Generate concise, useful copy for the landing-page workflow.",
		"Do not emit a complete page contract yet; that prompt is owned by the later artifacts slice.",
		modeLine(mode),
	];

	// Optional composer settings become extra hints for the model.
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

// Convert composer mode into a short instruction for the model.
function modeLine(mode: ComposerMetadata["mode"]): string {
	switch (mode) {
		case "page":
			return "Mode: page. Focus on landing-page structure, sections, offer clarity, and conversion copy.";
		case "marketing":
			return "Mode: marketing. Focus on positioning, audience, hooks, objections, and campaign copy.";
		case "image":
			return "Mode: image. Focus on visual direction and asset prompts; do not create binary assets.";
		case "auto":
			return "Mode: auto. Infer the user's intended generation direction from the prompt.";
	}
}
