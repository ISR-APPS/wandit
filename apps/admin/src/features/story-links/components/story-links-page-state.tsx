import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

type StoryLinksPageStateProps = {
	icon: LucideIcon;
	title: string;
	description: string;
	action?: ReactNode;
};

function StoryLinksPageState({
	icon: Icon,
	title,
	description,
	action,
}: StoryLinksPageStateProps) {
	return (
		<Empty className="min-h-[480px] border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Icon />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{action ? <EmptyContent>{action}</EmptyContent> : null}
		</Empty>
	);
}

export type { StoryLinksPageStateProps };
export { StoryLinksPageState };
