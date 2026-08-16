import type { LucideIcon } from "lucide-react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

type AnalyticsPageStateProps = {
	icon: LucideIcon;
	title: string;
	description: string;
	onRetry?: () => void;
};

function AnalyticsPageState({
	icon: Icon,
	title,
	description,
	onRetry,
}: AnalyticsPageStateProps) {
	return (
		<Empty className="min-h-[480px] border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Icon />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{onRetry ? (
				<EmptyContent>
					<Button type="button" onClick={onRetry}>
						<RefreshCwIcon data-icon="inline-start" />
						Retry
					</Button>
				</EmptyContent>
			) : null}
		</Empty>
	);
}

export type { AnalyticsPageStateProps };
export { AnalyticsPageState };
