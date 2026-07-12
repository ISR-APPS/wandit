import type { TextUIPart } from "ai";
import { useRef } from "react";

import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { useAnimatedText } from "../../../lib/use-animated-text";
import { RealChatMessage } from "../real-message";

export function TextPart({
	messageRole,
	part,
	isStreaming,
}: {
	messageRole: WanditUIMessage["role"];
	part: TextUIPart;
	isStreaming: boolean;
}) {
	// Latch, not a live flag: once this part has streamed, keep the animated
	// reveal on even after the stream ends, so the cursor finishes its
	// catch-up tail instead of snapping to the full text. Parts that mount
	// from history (or user bubbles) never animate.
	const hasStreamed = useRef(isStreaming);
	if (isStreaming) hasStreamed.current = true;

	const text = useAnimatedText(part.text, hasStreamed.current);

	return (
		<RealChatMessage
			messageRole={messageRole}
			text={text}
			// Keep the caret blinking through the catch-up tail: the reveal can
			// still be typing after the network said "done".
			isStreaming={isStreaming || text !== part.text}
		/>
	);
}
