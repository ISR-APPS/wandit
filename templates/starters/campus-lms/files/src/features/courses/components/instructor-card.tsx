// The instructor row of the Courses page: the avatar, the name, the job, and two actions on the chosen course.
// CoursesPage renders it under the spotlight panel. "Copy link" puts the URL of the course page on the clipboard.
import { ArrowUpRightIcon, ShareNetworkIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { copyToClipboard, PersonAvatar } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";

type InstructorCardProps = {
	/** The id of the chosen course: the `$courseId` of its page. */
	courseId: string;
	/** The instructor of the course, from the course query. */
	instructor: { name: string; title: string };
};

/** Two ghost buttons at the end, as in the kit: copy the course link, and open the course page. */
export function InstructorCard({ courseId, instructor }: InstructorCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardContent className="flex items-center gap-4">
				<PersonAvatar name={instructor.name} className="size-12 text-sm" />
				<div className="grid min-w-0 flex-1 gap-0.5">
					<h3 className="truncate font-semibold">{instructor.name}</h3>
					<p className="truncate text-muted-foreground text-sm">
						{`${t("courses.instructor")} · ${instructor.title}`}
					</p>
				</div>
				<div className="flex gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t("courses.copyLink")}
						onClick={() =>
							copyToClipboard(
								`${window.location.origin}/app/courses/${courseId}`,
								{
									done: t("courses.linkCopied"),
									failed: t("table.copyFailed"),
								},
							)
						}
					>
						<ShareNetworkIcon />
					</Button>
					<Button variant="ghost" size="icon" asChild>
						<Link
							to="/app/courses/$courseId"
							params={{ courseId }}
							aria-label={t("courses.openPage")}
						>
							<ArrowUpRightIcon className="rtl:-scale-x-100" />
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
