import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type {
	AdminPublication,
	AdminPublicationStatus,
} from "@/features/publications/api/publications.dto";
import {
	formatPublicationDateTime,
	formatPublicationRelativeTime,
	publicationLinkHost,
} from "@/features/publications/lib/formatters";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part.charAt(0).toUpperCase())
			.join("") || "?"
	);
}

function PublicationPublishedAt({
	publication,
}: {
	publication: AdminPublication;
}) {
	return (
		<div>
			<p className="tabular-nums">
				{formatPublicationDateTime(publication.publishedAt)}
			</p>
			<p className="text-muted-foreground text-xs">
				{formatPublicationRelativeTime(publication.publishedAt)}
			</p>
		</div>
	);
}

function PublicationUser({ publication }: { publication: AdminPublication }) {
	const user = publication.user;

	return (
		<div className="flex w-full min-w-0 items-center gap-3">
			<Avatar size="lg" className="border">
				<AvatarImage src={user.image ?? undefined} alt="" />
				<AvatarFallback className="font-medium">
					{getInitials(user.name)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<Link
					to="/users/$userId"
					params={{ userId: user.id }}
					className="block truncate font-medium text-foreground outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
				>
					{user.name}
				</Link>
				<p className="truncate text-muted-foreground text-xs">{user.email}</p>
			</div>
		</div>
	);
}

function PublicationLink({ publication }: { publication: AdminPublication }) {
	const href =
		publication.status === "active"
			? (publication.publicUrl ?? publication.liveUrl)
			: null;

	if (!href) {
		return (
			<span className="truncate font-mono text-muted-foreground text-xs">
				{publication.slug}
			</span>
		);
	}

	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="inline-flex max-w-full items-center gap-1 truncate font-medium text-foreground outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
		>
			<span className="truncate">{publicationLinkHost(href)}</span>
			<ExternalLinkIcon
				className="size-3.5 shrink-0 text-muted-foreground"
				aria-hidden="true"
			/>
		</a>
	);
}

const statusClasses: Record<AdminPublicationStatus, string> = {
	active:
		"border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
	superseded: "text-foreground/80",
	unpublished: "text-muted-foreground",
};

const statusLabels: Record<AdminPublicationStatus, string> = {
	active: "Active",
	superseded: "Superseded",
	unpublished: "Unpublished",
};

function PublicationStatusBadge({
	status,
}: {
	status: AdminPublicationStatus;
}) {
	return (
		<Badge variant="outline" className={cn(statusClasses[status])}>
			{statusLabels[status]}
		</Badge>
	);
}

export {
	PublicationLink,
	PublicationPublishedAt,
	PublicationStatusBadge,
	PublicationUser,
};
