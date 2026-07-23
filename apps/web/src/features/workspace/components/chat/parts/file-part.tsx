// Renders a persisted AI SDK v7 `type: "file"` part (contract §10.4): user
// attachments (initial message or mid-conversation) whose `url` is a public
// R2 asset. Images show as a small rounded thumbnail; everything else as a
// quiet filename chip. Display-only — the canonical file lives in R2.

import { FileText } from "lucide-react";

type FilePartData = {
	type: "file";
	mediaType: string;
	filename?: string;
	url: string;
};

export function FilePart({ part }: { part: FilePartData }) {
	if (part.mediaType.startsWith("image/")) {
		return (
			<div className="flex justify-end">
				<a
					href={part.url}
					target="_blank"
					rel="noreferrer"
					className="block max-w-48 overflow-hidden rounded-xl border border-border"
				>
					<img
						src={part.url}
						alt={part.filename ?? ""}
						loading="lazy"
						className="block max-h-40 w-full object-cover"
					/>
				</a>
			</div>
		);
	}

	return (
		<div className="flex justify-end">
			<a
				href={part.url}
				target="_blank"
				rel="noreferrer"
				className="inline-flex h-8 max-w-64 items-center gap-2 rounded-full border border-border bg-muted/60 px-3 text-muted-foreground text-xs transition-colors hover:text-foreground"
			>
				<FileText className="size-3.5 shrink-0" />
				<span dir="auto" className="min-w-0 truncate">
					{part.filename ?? part.url.split("/").at(-1) ?? "file"}
				</span>
			</a>
		</div>
	);
}
