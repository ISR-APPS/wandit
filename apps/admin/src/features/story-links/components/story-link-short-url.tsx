import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildStoryLinkUrl } from "@/features/story-links/lib/story-link-helpers";
import { cn } from "@/lib/utils";

type StoryLinkShortUrlProps = {
	link: {
		name: string;
		slug: string;
	};
	mobile?: boolean;
	pathOnly?: boolean;
};

function StoryLinkShortUrl({
	link,
	mobile = false,
	pathOnly = false,
}: StoryLinkShortUrlProps) {
	const url = buildStoryLinkUrl(link.slug);
	const displayedUrl = pathOnly ? `/s/${encodeURIComponent(link.slug)}` : url;

	return (
		<div
			className={cn("flex min-w-0 items-center gap-1.5", !mobile && "max-w-72")}
		>
			<code
				className="min-w-0 whitespace-normal break-all font-mono text-[11px] tabular-nums"
				title={url}
			>
				{displayedUrl}
			</code>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="shrink-0"
						aria-label={`Copy short URL for ${link.name}`}
						onClick={() => void copyShortUrl(url)}
					>
						<CopyIcon aria-hidden="true" />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="top" sideOffset={6}>
					Copy short URL
				</TooltipContent>
			</Tooltip>
		</div>
	);
}

async function copyShortUrl(url: string) {
	try {
		await navigator.clipboard.writeText(url);
		toast.success("Short URL copied");
	} catch {
		toast.error("The short URL could not be copied.");
	}
}

export type { StoryLinkShortUrlProps };
export { StoryLinkShortUrl };
