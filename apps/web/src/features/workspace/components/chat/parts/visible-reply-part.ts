import type { WanditUIMessage } from "../../../lib/use-ai-chat";

type MessagePart = WanditUIMessage["parts"][number];

const VISIBLE_ASSISTANT_REPLY_PART_TYPES = new Set([
	"tool-ask_user",
	"tool-generate_page",
	"tool-generate_marketing_asset",
	"tool-generate_image",
	"tool-scrape_leads",
	"tool-animate_image",
	"tool-generate_video",
	"tool-edit_video",
	"tool-extend_video",
	"dynamic-tool",
]);

/** Whether a streamed assistant part replaces the pane's thinking indicator. */
export function isVisibleAssistantReplyPart(part: MessagePart): boolean {
	if (part.type === "text") return part.text.length > 0;
	return VISIBLE_ASSISTANT_REPLY_PART_TYPES.has(part.type);
}
