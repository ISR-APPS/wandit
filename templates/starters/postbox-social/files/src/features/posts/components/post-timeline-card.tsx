// The history of one post: drafted, approved, scheduled, then published or refused. A scheduled post ends with its next step.
// PostDetailPage renders it in the rail. The steps come from the times of the post, so no step is in the future.
import { fillMessage, HOUR_MS, MINUTE_MS, type Post } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type PostTimelineCardProps = {
	post: Post;
};

/** One step of the timeline. The tone "next" marks the step that has not happened yet. */
type TimelineStep = {
	id: string;
	text: string;
	time: string;
	tone: "done" | "failed" | "next";
};

// The team approves a draft about five hours after the author writes it.
const APPROVAL_DELAY_HOURS = 5;

// The approver books the time slot a few minutes after the approval.
const BOOKING_DELAY_MINUTES = 20;

/** The steps run oldest first. A draft has one step; a published post has four. */
export function PostTimelineCard({ post }: PostTimelineCardProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const created = Date.parse(post.createdAt);
	const approved = created + APPROVAL_DELAY_HOURS * HOUR_MS;
	const booked = approved + BOOKING_DELAY_MINUTES * MINUTE_MS;
	const steps: TimelineStep[] = [
		{
			id: "drafted",
			text: fillMessage(t("posts.timeline.drafted"), { name: post.author }),
			time: dateTime.format(created),
			tone: "done",
		},
	];
	if (post.publishAt) {
		const publishAt = Date.parse(post.publishAt);
		steps.push(
			{
				id: "approved",
				text: fillMessage(t("posts.timeline.approved"), {
					name: post.approver,
				}),
				time: dateTime.format(approved),
				tone: "done",
			},
			{
				id: "scheduled",
				text: fillMessage(t("posts.timeline.scheduled"), {
					when: dateTime.format(publishAt),
				}),
				time: dateTime.format(booked),
				tone: "done",
			},
		);
		steps.push(
			post.status === "published"
				? {
						id: "published",
						text: t("posts.timeline.published"),
						time: dateTime.format(publishAt),
						tone: "done",
					}
				: post.status === "failed"
					? {
							id: "failed",
							text: t("posts.timeline.failed"),
							time: dateTime.format(publishAt),
							tone: "failed",
						}
					: {
							id: "next",
							text: t("posts.timeline.goesLive"),
							time: dateTime.format(publishAt),
							tone: "next",
						},
		);
	} else {
		steps.push({
			id: "next",
			text: t("posts.timeline.needsSlot"),
			time: "",
			tone: "next",
		});
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("posts.timeline.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="grid">
					{steps.map((step, index) => (
						<li key={step.id} className="grid grid-cols-[1rem_1fr] gap-3">
							<span className="relative flex justify-center">
								<span
									aria-hidden="true"
									className={cn(
										"relative z-10 mt-1.5 size-2.5 rounded-full",
										step.tone === "done" && "bg-primary",
										step.tone === "failed" && "bg-destructive",
										step.tone === "next" &&
											"border border-muted-foreground bg-card",
									)}
								/>
								{index < steps.length - 1 ? (
									<span
										aria-hidden="true"
										className="absolute top-4 bottom-0 w-px bg-border"
									/>
								) : null}
							</span>
							<div className="grid gap-0.5 pb-5">
								<span
									className={cn(
										"text-sm",
										step.tone === "next" && "text-muted-foreground",
									)}
								>
									{step.text}
								</span>
								{step.time === "" ? null : (
									<span className="text-muted-foreground text-xs tabular-nums">
										{step.time}
									</span>
								)}
							</div>
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
