import type { ReactNode } from "react";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

type ProjectSectionEmptyProps = {
	description: string;
	icon: ReactNode;
	title: string;
};

export function ProjectSectionEmpty({
	description,
	icon,
	title,
}: ProjectSectionEmptyProps) {
	return (
		<Empty className="min-h-48 border-0 py-6">
			<EmptyHeader>
				<EmptyMedia variant="icon">{icon}</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
