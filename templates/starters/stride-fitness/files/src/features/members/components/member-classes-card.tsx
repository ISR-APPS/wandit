// The classes card of the member page: each class type of the visit history, with its count, as a badge.
// MemberDetailPage renders it under the week card. It follows the skills card of the kit profile page.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { ClassCount } from "../lib/member-rows";

type MemberClassesCardProps = {
	/** The class types of the history, the most visited first. */
	counts: ClassCount[];
};

/** A member with open gym visits only sees one muted sentence. */
export function MemberClassesCard({ counts }: MemberClassesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("members.classesTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{counts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("members.noClasses")}
					</p>
				) : (
					<ul className="flex flex-wrap gap-2">
						{counts.map((count) => (
							<li key={count.classTypeId}>
								<Badge variant="outline" className="gap-1.5">
									{count.className}
									<span className="text-muted-foreground tabular-nums">
										{number.format(count.visits)}
									</span>
								</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
