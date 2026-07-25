import type { LucideIcon } from "lucide-react";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

type AdminPlaceholderPageProps = {
	icon: LucideIcon;
	title: string;
	description: string;
};

export function AdminPlaceholderPage({
	icon: Icon,
	title,
	description,
}: AdminPlaceholderPageProps) {
	return (
		<Empty className="min-h-(--content-full-height) border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Icon />
				</EmptyMedia>
				<EmptyTitle className="text-xl">{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
