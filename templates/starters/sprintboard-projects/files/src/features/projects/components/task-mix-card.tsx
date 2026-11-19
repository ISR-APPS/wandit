// The task mix card of a project page: one outline badge per task kind and per status, with its count.
// ProjectDetailPage renders it under the completion card. It counts every task of the project.
import { TASK_KINDS, TASK_STATUSES, type Task } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

/** The kinds come first, then the statuses in board order. A count of 0 still shows. */
export function TaskMixCard({ tasks }: { tasks: Task[] }) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const tags = [
		...TASK_KINDS.map((kind) => ({
			id: kind,
			label: t(`kind.${kind}`),
			count: tasks.filter((task) => task.kind === kind).length,
		})),
		...TASK_STATUSES.map((status) => ({
			id: status,
			label: t(`status.${status}`),
			count: tasks.filter((task) => task.status === status).length,
		})),
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("project.taskMix")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-wrap gap-2">
					{tags.map((tag) => (
						<li key={tag.id}>
							<Badge variant="outline" className="gap-1.5">
								{tag.label}
								<span className="text-muted-foreground tabular-nums">
									{number.format(tag.count)}
								</span>
							</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
