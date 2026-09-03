/**
 * Provider-proven prompt for a surgical edit of an existing clip.
 *
 * Keep this deterministic: the edit engine infers the operation from this
 * exact framing, and a model-authored director would introduce unrequested
 * cinematography.
 */
export function buildEditPrompt(instruction: string): string {
	return (
		`Surgical edit of [Video 1]: ${instruction}. ` +
		"Keep everything else exactly the same as the source video: the framing, " +
		"the lighting, the camera movement, and the timing."
	);
}

/**
 * Continuation prompt shared by every durable extension leg.
 *
 * Each leg starts from the previous clip's final frame; repeating the same
 * continuity constraints prevents later legs from drifting into a new scene.
 */
export function buildContinuationPrompt(continuationBrief: string): string {
	return (
		`Continue this exact scene from the final frame: ${continuationBrief}. ` +
		"Keep the same setting, subjects, lighting, color grade, and camera style. " +
		"No scene change, no new characters, no on-screen text."
	);
}
