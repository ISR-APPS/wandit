// A card of audience parts with a share bar per row: the age ranges or the top cities.
// AudiencePage renders it two times. The cities are ranked, so they get a rank number; the "other" row is muted and last.
import { ShareBar, shareFormat } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { AudiencePart } from "../api/audience.queries";

type AudiencePartsCardProps = {
	title: string;
	description: string;
	/** The rows in their display order. A row with the label "other" is the rest of the audience. */
	parts: AudiencePart[];
	/** True for a ranking (largest first): the rows get rank numbers. False keeps a natural order, like ages. */
	isRanked: boolean;
};

/** The bar width is the share over the largest share, so the largest part fills its bar. */
export function AudiencePartsCard({
	title,
	description,
	parts,
	isRanked,
}: AudiencePartsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const largest = Math.max(
		...parts.filter((part) => part.label !== "other").map((part) => part.share),
		0.0001,
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<ol className="grid gap-4">
					{parts.map((part, index) => {
						const isOther = part.label === "other";
						return (
							<li
								key={part.label}
								className={cn(
									"grid gap-x-3 gap-y-1.5",
									isRanked ? "grid-cols-[1.25rem_1fr]" : "grid-cols-1",
								)}
							>
								{isRanked ? (
									<span className="text-muted-foreground text-sm tabular-nums">
										{isOther ? "" : number.format(index + 1)}
									</span>
								) : null}
								<div className="flex items-baseline justify-between gap-3 text-sm">
									<span
										className={cn(
											"font-medium",
											isOther && "font-normal text-muted-foreground",
										)}
									>
										{isOther ? t("audience.other") : <bdi>{part.label}</bdi>}
									</span>
									<span className="flex items-baseline gap-3 tabular-nums">
										<span className="text-muted-foreground text-xs">
											{number.format(part.followers)}
										</span>
										<span className="w-10 text-end">
											{share.format(part.share)}
										</span>
									</span>
								</div>
								<ShareBar
									share={part.share / largest}
									fillClassName={isOther ? "bg-muted-foreground/40" : undefined}
									className={isRanked ? "col-start-2" : undefined}
								/>
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
