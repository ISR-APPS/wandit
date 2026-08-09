// Throwaway: prove the attached-image fix end to end against the LIVE chat
// model. Replays Zack's exact scenario — fresh chat, one attached product
// photo, "make a commercial shot" — once WITHOUT the URL marker (the bug:
// model asks for the photo it already has) and once WITH annotateUserFileParts
// + the updated system prompt (expected: generate_image with sourceImageUrls).
// npx tsx scripts/test-attachment-marker.ts
import { env } from "@wandit/env/server";
import { convertToModelMessages, generateText } from "ai";
import { annotateUserFileParts } from "../src/modules/ai-chat/agent/annotate-file-parts";
import type { WanditUIMessage } from "../src/modules/ai-chat/agent/chat-agent";
import { aiChatToolsForValidation } from "../src/modules/ai-chat/agent/chat-agent";
import { WANDIT_SYSTEM_PROMPT } from "../src/modules/ai-chat/agent/system-prompt";
import { withGatewayAttribution } from "../src/modules/metering/domain/gateway-metering";

const IMAGE_URL =
	"https://pub-c02c83400014443282b2beb4b919831d.r2.dev/images/media-tests/harness-text-1784978616424/img-1.png";

const userMessage: WanditUIMessage = {
	id: "m1",
	parts: [
		{
			filename: "produit.png",
			mediaType: "image/png",
			type: "file",
			url: IMAGE_URL,
		},
		{
			text: "Voici mon image, fais-moi une photo commerciale professionnelle de mon produit.",
			type: "text",
		},
	],
	role: "user",
};

const cases: Array<[string, WanditUIMessage[]]> = [
	["WITHOUT marker (old behavior)", [userMessage]],
	["WITH marker (the fix)", annotateUserFileParts([userMessage])],
];

for (const [label, messages] of cases) {
	console.log(`\n=== ${label} ===`);
	const result = await generateText({
		messages: await convertToModelMessages(messages),
		model: env.AI_CHAT_MODEL,
		providerOptions: withGatewayAttribution(
			{},
			{
				operation: "chat",
				userId: "diagnostic:test-attachment-marker",
			},
		),
		system: WANDIT_SYSTEM_PROMPT,
		tools: aiChatToolsForValidation,
	});
	for (const call of result.toolCalls) {
		console.log(`tool: ${call.toolName}`);
		console.log(`input: ${JSON.stringify(call.input).slice(0, 1200)}`);
	}
	if (result.toolCalls.length === 0) {
		console.log("no tool calls");
	}
	if (result.text.trim()) {
		console.log(`text: ${result.text.slice(0, 300)}`);
	}
}
