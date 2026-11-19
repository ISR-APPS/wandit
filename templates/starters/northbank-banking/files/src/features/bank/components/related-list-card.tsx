// A list card of related records: an initials avatar, a name, one muted line, and a button per row.
// The detail pages render it at the end of their end column, for example "Other cards" or "Same day".
// It follows the "connections" card of the kit detail anatomy.
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

/** One row of the list. */
export type RelatedItem = {
	/** Stable key, for example the record id. */
	id: string;
	/** One or two letters for the avatar. */
	initials: string;
	name: string;
	/** One muted line under the name, for example the bank or the amount. */
	detail: ReactNode;
	/** The button at the end of the row, for example an "Open" link. */
	action: ReactNode;
};

type RelatedListCardProps = {
	title: string;
	description?: string;
	/** One control at the end of the head, for example an icon link to the list page. */
	headerAction?: ReactNode;
	items: RelatedItem[];
	/** One muted sentence when `items` is empty. */
	emptyText: string;
};

/** The rows stack with gap-6, as in the kit. */
export function RelatedListCard({
	title,
	description,
	headerAction,
	items,
	emptyText,
}: RelatedListCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
				{headerAction ? <CardAction>{headerAction}</CardAction> : null}
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<p className="text-muted-foreground text-sm">{emptyText}</p>
				) : (
					<ul className="grid gap-6">
						{items.map((item) => (
							<li key={item.id} className="flex items-center gap-3">
								<Avatar className="size-9">
									<AvatarFallback className="bg-muted text-xs">
										{item.initials}
									</AvatarFallback>
								</Avatar>
								<div className="grid min-w-0 flex-1 gap-0.5">
									<p className="truncate font-medium text-sm" dir="auto">
										{item.name}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{item.detail}
									</p>
								</div>
								{item.action}
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
