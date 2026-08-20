import type { ModelMessage, UserContent } from "ai";

export function composeBuildStartMessages(params: {
	brief: string;
	title: string;
	userPhotoUrls: string[];
}): ModelMessage[] {
	const content: Exclude<UserContent, string> = [
		{
			text:
				`Build the landing page now.\n\nTITLE: ${params.title}\n\n` +
				`BRIEF:\n${params.brief}`,
			type: "text",
		},
	];

	for (const [index, url] of params.userPhotoUrls.entries()) {
		content.push({
			text: `[User photo ${index + 1} — URL: ${url}]`,
			type: "text",
		});
		content.push({ data: url, mediaType: "image", type: "file" });
	}

	content.push({
		text: "These are the user's real photos from the brief, attached so you can SEE them. Judge each one's quality before you write HTML, per your PHOTO QUALITY GATE law. To enhance, restage, or refit one to a slot's shape, pass its exact URL from its marker as generate_image sourceImageUrls.",
		type: "text",
	});

	return [{ content, role: "user" }];
}
