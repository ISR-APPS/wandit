import type { ReactNode } from "react";

import type { AdminPublication } from "@/features/publications/api/publications.dto";
import {
	formatPublicationDateTime,
	formatPublicationRelativeTime,
} from "@/features/publications/lib/formatters";

import {
	PublicationLink,
	PublicationStatusBadge,
	PublicationUser,
} from "./publication-table-cells";

function PublicationsMobileList({
	publications,
}: {
	publications: AdminPublication[];
}) {
	return (
		<div className="space-y-3 lg:hidden">
			{publications.map((publication) => (
				<article
					key={publication.id}
					className="overflow-hidden rounded-xl border bg-background"
				>
					<div className="flex items-center gap-3 border-b p-3">
						<div className="min-w-0 flex-1">
							<PublicationUser publication={publication} />
						</div>
						<PublicationStatusBadge status={publication.status} />
					</div>

					<div className="grid grid-cols-2 divide-x">
						<MobileDatum label="Project">
							<p className="truncate font-medium">{publication.project.name}</p>
						</MobileDatum>
						<MobileDatum label="Link">
							<PublicationLink publication={publication} />
						</MobileDatum>
					</div>

					<div className="border-t px-3 py-2.5 text-xs">
						<span className="text-muted-foreground">
							Published {formatPublicationDateTime(publication.publishedAt)} (
							{formatPublicationRelativeTime(publication.publishedAt)})
						</span>
					</div>
				</article>
			))}
		</div>
	);
}

function MobileDatum({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="min-w-0 space-y-1 px-3 py-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<div className="min-w-0 text-sm">{children}</div>
		</div>
	);
}

export { PublicationsMobileList };
