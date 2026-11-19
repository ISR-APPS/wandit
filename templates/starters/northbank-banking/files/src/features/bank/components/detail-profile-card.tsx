// The first card of a detail page: an initials avatar, the name and a badge, a strip of 3 figures,
// and a list of facts with icons. The transaction, card, payee, and statement pages render it in their start column.
// It follows the profile card of the kit detail anatomy. No photo: the avatar shows initials.
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

/** One cell of the figure strip. */
export type ProfileStat = {
	/** The muted caption under the figure, already translated. */
	label: string;
	/** The figure, already formatted, for example "$1,250" or "14". */
	value: ReactNode;
};

/** One line of the fact list. */
export type ProfileFact = {
	/** Stable key of the line, for example "bank". */
	id: string;
	icon: KitIcon;
	/** The name of the fact for screen readers, for example "Bank". The icon stands for it on screen. */
	label: string;
	content: ReactNode;
};

type DetailProfileCardProps = {
	/** One or two letters for the avatar, for example "CR". */
	initials: string;
	name: string;
	/** A status or group Badge beside the name. */
	badge?: ReactNode;
	/** One muted line under the name, for example the role or the category. */
	subtitle: string;
	/** Exactly 3 cells look like the kit. */
	stats: ProfileStat[];
	facts: ProfileFact[];
};

/** Centered head, the strip in a muted box, then the facts. The name renders with dir="auto". */
export function DetailProfileCard({
	initials,
	name,
	badge,
	subtitle,
	stats,
	facts,
}: DetailProfileCardProps) {
	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="flex flex-col items-center gap-4 text-center">
					<Avatar className="size-20">
						<AvatarFallback className="bg-muted font-display text-xl">
							{initials}
						</AvatarFallback>
					</Avatar>
					<div className="grid justify-items-center gap-1">
						{/* The badge sits beside the heading, not in it, so it keeps the body font. */}
						<div className="flex flex-wrap items-center justify-center gap-2">
							<h2 className="font-display font-semibold text-xl" dir="auto">
								{name}
							</h2>
							{badge}
						</div>
						<p className="text-muted-foreground text-sm">{subtitle}</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x divide-border rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{stats.map((stat) => (
						<div
							key={stat.label}
							className="grid min-w-0 content-start gap-0.5 px-2 py-3"
						>
							{/* The figure shows above its caption, as in the kit. The DOM keeps dt before dd. */}
							<dt className="order-last truncate text-muted-foreground text-sm">
								{stat.label}
							</dt>
							<dd className="truncate font-numeric font-semibold text-lg tabular-nums">
								{stat.value}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4">
					{facts.map((fact) => (
						<li key={fact.id} className="flex items-center gap-3 text-sm">
							<fact.icon className="size-4 shrink-0 text-muted-foreground" />
							<span className="sr-only">{fact.label}: </span>
							<span className="min-w-0 truncate">{fact.content}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
