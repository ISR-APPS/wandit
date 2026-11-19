// The two small cards under the profile card of a detail page: one progress figure, and a set of tags.
// The transaction, card, payee, and statement pages render them in their start column.
// They follow the "complete your profile" and "skills" cards of the kit detail anatomy.
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type DetailProgressCardProps = {
	title: string;
	/** One muted line under the title that says what the bar measures. */
	description: string;
	/** 0 to 100. A value above 100 fills the bar; the label still shows the real figure. */
	percent: number;
	/** The figure at the end of the bar, already formatted, for example "68%". */
	valueLabel: string;
};

/** A bar and its figure on one row. */
export function DetailProgressCard({
	title,
	description,
	percent,
	valueLabel,
}: DetailProgressCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress value={percent} aria-label={title} />
				<span className="shrink-0 text-muted-foreground text-sm tabular-nums">
					{valueLabel}
				</span>
			</CardContent>
		</Card>
	);
}

/** One tag of a DetailTagsCard. */
export type DetailTag = {
	/** Stable key, for example a category code. */
	id: string;
	/** The translated word of the tag. */
	label: string;
};

type DetailTagsCardProps = {
	title: string;
	tags: DetailTag[];
};

/** Outline badges that wrap. No tag: the card does not render. */
export function DetailTagsCard({ title, tags }: DetailTagsCardProps) {
	if (tags.length === 0) {
		return null;
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-wrap gap-2">
					{tags.map((tag) => (
						<li key={tag.id}>
							<Badge variant="outline">{tag.label}</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
