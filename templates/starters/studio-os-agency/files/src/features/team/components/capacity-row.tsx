// One person on the Team page: the name and role, a bar of billable and studio hours against capacity, and the utilization.
// TeamPage renders one row per member. A click opens the member sheet.
import { PersonAvatar, useFormatters } from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { MemberLoad } from "../lib/team-load";

type CapacityRowProps = {
	member: MemberLoad;
	/** The hours that fill the whole bar: the largest capacity or logged total of the team. */
	scaleHours: number;
	/** Opens the sheet of this member. */
	onOpen: () => void;
};

/** The capacity tick marks the contract hours. Hours past it are overtime. */
export function CapacityRow({ member, scaleHours, onOpen }: CapacityRowProps) {
	const { t } = useT();
	const format = useFormatters();
	const widthOf = (hours: number) => `${(hours / scaleHours) * 100}%`;
	const isOver = member.utilization > 1;
	return (
		<button
			type="button"
			onClick={onOpen}
			className="grid @2xl/main:grid-cols-[13rem_minmax(0,1fr)_7rem] grid-cols-1 items-center gap-x-6 gap-y-3 rounded-control px-3 py-3 text-start outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<span className="flex items-center gap-3">
				<PersonAvatar name={member.name} className="size-9" />
				<span className="grid">
					<span className="font-medium text-sm">{member.name}</span>
					<span className="text-muted-foreground text-xs">
						{`${t(`codes.roles.${member.role}`)} · ${t("team.perWeek").replace("{hours}", format.number(member.weeklyCapacity))}`}
					</span>
				</span>
			</span>
			<span
				aria-hidden="true"
				className="relative flex h-3 rounded-sm bg-muted"
			>
				<span
					className="h-full rounded-s-sm bg-chart-1"
					style={{ width: widthOf(member.billable) }}
				/>
				<span
					className="h-full rounded-e-sm bg-chart-2"
					style={{ width: widthOf(member.studio) }}
				/>
				<span
					className="absolute -inset-y-1 w-0.5 rounded-full bg-chart-3"
					style={{ insetInlineStart: widthOf(member.capacity) }}
				/>
			</span>
			<span className="flex items-baseline @2xl/main:justify-end justify-between gap-3">
				<span className="text-muted-foreground text-xs tabular-nums">
					{format.hours(member.billable)}
				</span>
				<span
					className={cn(
						"w-14 text-end font-numeric font-semibold text-lg tabular-nums",
						isOver && "text-destructive",
					)}
				>
					{format.percent(member.utilization)}
				</span>
			</span>
		</button>
	);
}
