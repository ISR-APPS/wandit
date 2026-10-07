/**
 * The filter controls of the dashboard Leads page: a "Filters" button that adds
 * a filter, and one chip per active filter. A filter has no condition step: the
 * user picks the filter, then its value, and the value applies at once. The chip
 * value opens the list again, and its cross removes the filter.
 * pages/workspace-leads-page.tsx renders it beside the search field and owns the values.
 */

import type { Icon } from "@phosphor-icons/react";
import { ArchiveIcon } from "@phosphor-icons/react/Archive";
import { CalendarBlankIcon } from "@phosphor-icons/react/CalendarBlank";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { CircleHalfIcon } from "@phosphor-icons/react/CircleHalf";
import { FunnelSimpleIcon } from "@phosphor-icons/react/FunnelSimple";
import { MegaphoneIcon } from "@phosphor-icons/react/Megaphone";
import { SquaresFourIcon } from "@phosphor-icons/react/SquaresFour";
import { XIcon } from "@phosphor-icons/react/X";
import type {
	LeadSource,
	LeadStatus,
	WorkspaceLeadsQuery,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@wandit/ui/components/command";
import { Input } from "@wandit/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { cn } from "@wandit/ui/lib/utils";
import { type ReactNode, useRef, useState } from "react";

import type { Project } from "@/features/projects";
import {
	LEAD_SOURCES,
	LEAD_STATUS_META,
	LEAD_STATUS_ORDER,
	type LeadDateFilter,
	SOURCE_DOT_CLASS,
} from "@/features/workspace";
import { formatDate, useTranslation } from "@/lib/i18n";

/** The filter values of the Leads page. The page turns them into the list query. */
export type LeadFilterValues = {
	/** Id of a V1 project, or "all". */
	projectId: string;
	source: LeadSource | "all";
	status: LeadStatus | "all";
	date: LeadDateFilter;
	/** The day of the "pickDay" date filter, as yyyy-mm-dd from the date input. Empty until the user picks one. */
	pickedDay: string;
	/** "exclude" hides the archived leads. It is the default, so it shows no chip. */
	archived: WorkspaceLeadsQuery["archived"];
};

/** The values with no filter. The page starts with them, and "Clear filters" goes back to them. */
export const NO_LEAD_FILTERS: LeadFilterValues = {
	projectId: "all",
	source: "all",
	status: "all",
	date: "all",
	pickedDay: "",
	archived: "exclude",
};

/** True when one filter differs from its default. The search field is not a filter here. */
export function isLeadFilterOn(filters: LeadFilterValues): boolean {
	return (
		filters.projectId !== NO_LEAD_FILTERS.projectId ||
		filters.source !== NO_LEAD_FILTERS.source ||
		filters.status !== NO_LEAD_FILTERS.status ||
		filters.date !== NO_LEAD_FILTERS.date ||
		filters.archived !== NO_LEAD_FILTERS.archived
	);
}

type FilterKey = "projectId" | "source" | "status" | "date" | "archived";

type FilterOption = {
	/** Unique in its list: the cmdk row value. */
	id: string;
	label: string;
	/** Color dot of a source or a status, from the lead constants of the workspace feature. */
	dotClass?: string;
	/** The filter values after a pick of this option. */
	next: LeadFilterValues;
	/** True for "Pick a day": the list stays open, so the user can pick the day below it. */
	keepsListOpen?: boolean;
};

type FilterField = {
	key: FilterKey;
	label: string;
	icon: Icon;
	/** Label of the active value, or null when the filter is off. */
	valueLabel: string | null;
	/** Id of the active option, for the check mark. */
	selectedId: string;
	options: FilterOption[];
	/** The filter values after a click on the cross of the chip. */
	cleared: LeadFilterValues;
	/** Placeholder of the search field. Only the project list can be long enough to need one. */
	searchPlaceholder?: string;
	/** Extra control under the list: the date input of "Pick a day". */
	footer?: ReactNode;
};

// cmdk scores the row value by default. The values are ids, so the search reads only the label.
function matchLabel(_value: string, search: string, keywords?: string[]) {
	const needle = search.trim().toLocaleLowerCase();
	return keywords?.some((keyword) =>
		keyword.toLocaleLowerCase().includes(needle),
	)
		? 1
		: 0;
}

// The same white pill as the search field, so the toolbar reads as one row.
const PILL_CLASS =
	"bg-white ring-1 ring-night/10 dark:bg-card dark:ring-border";

// A hover on a cmdk row moves the focus into that cmdk list when the focus is in any cmdk list.
// A list that fades out under the pointer then takes the focus, and the new list closes.
const CLOSING_LIST_CLASS = "data-[state=closed]:pointer-events-none";

const DIVIDER_CLASS = "h-4 w-px shrink-0 bg-night/10 dark:bg-white/10";

/** The "Filters" button and one chip per active filter. It renders a fragment, so the page row wraps them with the search field. */
export function LeadFilterBar({
	filters,
	projects,
	onChange,
}: {
	filters: LeadFilterValues;
	/** The V1 projects of the workspace: only they capture leads. */
	projects: Pick<Project, "id" | "name">[];
	/** Gets the next values after a pick, a removal, or a new day. */
	onChange: (next: LeadFilterValues) => void;
}) {
	const { t, locale } = useTranslation();
	const [isAddOpen, setIsAddOpen] = useState(false);
	// The filter that the user just added. Its chip shows with an open list before it has a value.
	const [pendingKey, setPendingKey] = useState<FilterKey | null>(null);
	// True between a pick in the add list and the close of that list.
	const isPickingRef = useRef(false);
	// A chip that goes away takes its focused button with it, so the focus comes back here.
	const filtersButtonRef = useRef<HTMLButtonElement>(null);

	const projectName = projects.find(
		(project) => project.id === filters.projectId,
	)?.name;
	const dateLabels: Record<Exclude<LeadDateFilter, "all">, string> = {
		today: t("leads.dateToday"),
		last7Days: t("leads.dateLast7Days"),
		last30Days: t("leads.dateLast30Days"),
		pickDay: t("leads.datePickDay"),
	};

	const fields: FilterField[] = [
		{
			key: "projectId",
			label: t("leads.colProject"),
			icon: SquaresFourIcon,
			// The picked project can leave the list, for example after a delete. The chip then shows an ellipsis.
			valueLabel: filters.projectId === "all" ? null : (projectName ?? "…"),
			selectedId: filters.projectId,
			options: projects.map((project) => ({
				id: project.id,
				label: project.name,
				next: { ...filters, projectId: project.id },
			})),
			cleared: { ...filters, projectId: NO_LEAD_FILTERS.projectId },
			searchPlaceholder: t("leads.filters.searchProjects"),
		},
		{
			key: "source",
			label: t("leads.colSource"),
			icon: MegaphoneIcon,
			valueLabel:
				filters.source === "all" ? null : t(`leads.source.${filters.source}`),
			selectedId: filters.source,
			options: LEAD_SOURCES.map((source) => ({
				id: source,
				label: t(`leads.source.${source}`),
				dotClass: SOURCE_DOT_CLASS[source],
				next: { ...filters, source },
			})),
			cleared: { ...filters, source: NO_LEAD_FILTERS.source },
		},
		{
			key: "status",
			label: t("leads.colStatus"),
			icon: CircleHalfIcon,
			valueLabel:
				filters.status === "all" ? null : t(`leads.status.${filters.status}`),
			selectedId: filters.status,
			options: LEAD_STATUS_ORDER.map((status) => ({
				id: status,
				label: t(`leads.status.${status}`),
				dotClass: LEAD_STATUS_META[status].dotClass,
				next: { ...filters, status },
			})),
			cleared: { ...filters, status: NO_LEAD_FILTERS.status },
		},
		{
			key: "date",
			label: t("leads.colDate"),
			icon: CalendarBlankIcon,
			valueLabel:
				filters.date === "all"
					? null
					: filters.date === "pickDay" && filters.pickedDay
						? // Local midnight: a bare yyyy-mm-dd parses as UTC and can show the day before.
							formatDate(new Date(`${filters.pickedDay}T00:00:00`), locale, {
								dateStyle: "medium",
							})
						: dateLabels[filters.date],
			selectedId: filters.date,
			options: (["today", "last7Days", "last30Days", "pickDay"] as const).map(
				(date) => ({
					id: date,
					label: dateLabels[date],
					next: { ...filters, date },
					keepsListOpen: date === "pickDay",
				}),
			),
			cleared: { ...filters, date: NO_LEAD_FILTERS.date, pickedDay: "" },
			footer:
				filters.date === "pickDay" ? (
					<div className="border-popover-foreground/[0.08] border-t p-2">
						<Input
							type="date"
							value={filters.pickedDay}
							onChange={(event) =>
								onChange({ ...filters, pickedDay: event.target.value })
							}
							aria-label={t("leads.datePickDay")}
							className="h-9 rounded-xl"
						/>
					</div>
				) : undefined,
		},
		{
			key: "archived",
			label: t("leads.filters.archive"),
			icon: ArchiveIcon,
			valueLabel:
				filters.archived === "only"
					? t("leads.filterArchived")
					: filters.archived === "include"
						? t("leads.filterAllLeads")
						: null,
			selectedId: filters.archived,
			// "Active" is the default, so the list holds only the two other choices.
			options: [
				{
					id: "only",
					label: t("leads.filterArchived"),
					next: { ...filters, archived: "only" },
				},
				{
					id: "include",
					label: t("leads.filterAllLeads"),
					next: { ...filters, archived: "include" },
				},
			],
			cleared: { ...filters, archived: NO_LEAD_FILTERS.archived },
		},
	];

	const activeCount = fields.filter(
		(field) => field.valueLabel !== null,
	).length;
	// The picked filter stays in the list while it fades out, so the rows do not move under the pointer.
	const addableFields = fields.filter((field) => field.valueLabel === null);
	const chipFields = fields.filter(
		(field) => field.valueLabel !== null || field.key === pendingKey,
	);

	return (
		<>
			<Popover open={isAddOpen} onOpenChange={setIsAddOpen}>
				<PopoverTrigger asChild>
					<Button
						ref={filtersButtonRef}
						type="button"
						variant="ghost"
						className={cn(
							PILL_CLASS,
							"h-10 gap-2 rounded-full px-3.5 font-grotesk font-semibold text-[13px] text-night hover:bg-night/[0.03] hover:text-night aria-expanded:bg-night/[0.05] dark:text-foreground dark:aria-expanded:bg-white/[0.06] dark:hover:bg-white/[0.04] dark:hover:text-foreground",
						)}
					>
						<FunnelSimpleIcon aria-hidden weight="bold" className="size-4" />
						{t("leads.filters.button")}
						{activeCount > 0 ? (
							<span className="grid h-5 min-w-5 place-items-center rounded-full bg-night px-1.5 text-[11px] text-paper tabular-nums dark:bg-spark dark:text-night">
								{activeCount}
							</span>
						) : null}
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className={cn("w-60 p-0", CLOSING_LIST_CLASS)}
					onCloseAutoFocus={(event) => {
						// After a pick, the focus goes to the list of the new chip, not back to this button.
						if (isPickingRef.current) {
							event.preventDefault();
							isPickingRef.current = false;
						}
					}}
				>
					<Command filter={matchLabel} label={t("leads.filters.button")}>
						<CommandInput placeholder={t("leads.filters.search")} />
						<CommandList>
							<CommandEmpty>{t("leads.filters.noneLeft")}</CommandEmpty>
							{addableFields.map((field) => (
								<CommandItem
									key={field.key}
									value={field.key}
									keywords={[field.label]}
									onSelect={() => {
										isPickingRef.current = true;
										setIsAddOpen(false);
										setPendingKey(field.key);
									}}
								>
									<field.icon aria-hidden weight="duotone" />
									{field.label}
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{chipFields.map((field) => (
				<FilterChip
					key={field.key}
					field={field}
					startsOpen={field.key === pendingKey}
					onPick={(next) => {
						setPendingKey(null);
						onChange(next);
					}}
					onListClose={(isFocusInList) => {
						// "Pick a day" with no day filters nothing, so it goes away like a new filter with no value.
						const isEmptyDay =
							field.key === "date" &&
							filters.date === "pickDay" &&
							!filters.pickedDay;
						// Only a focus that the chip takes away comes back here. A click on another chip or field keeps its focus.
						if (isFocusInList && (field.valueLabel === null || isEmptyDay)) {
							filtersButtonRef.current?.focus();
						}
						if (isEmptyDay) onChange(field.cleared);
						setPendingKey(null);
					}}
					onRemove={() => {
						filtersButtonRef.current?.focus();
						onChange(field.cleared);
					}}
				/>
			))}
		</>
	);
}

/** One active filter: the filter name, the value that opens the value list, and the cross that removes it. */
function FilterChip({
	field,
	startsOpen,
	onPick,
	onListClose,
	onRemove,
}: {
	field: FilterField;
	/** True for the filter that the user just added: its value list opens at once. */
	startsOpen: boolean;
	onPick: (next: LeadFilterValues) => void;
	/**
	 * Called when the value list closes. A new filter with no value then goes away.
	 * isFocusInList is false when the click that closed the list put the focus on another control.
	 */
	onListClose: (isFocusInList: boolean) => void;
	/** Called by the cross. The parent turns the filter off. */
	onRemove: () => void;
}) {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(startsOpen);
	const commandRef = useRef<HTMLDivElement>(null);
	const listContentRef = useRef<HTMLDivElement>(null);

	return (
		<fieldset
			aria-label={field.label}
			className={cn(
				PILL_CLASS,
				"inline-flex h-10 min-w-0 max-w-full items-center rounded-full font-grotesk text-[13px]",
			)}
		>
			<span className="flex shrink-0 items-center gap-1.5 ps-3.5 pe-1.5 font-medium text-night/60 dark:text-foreground/60">
				<field.icon aria-hidden weight="duotone" className="size-4" />
				{field.label}
			</span>
			<span aria-hidden className={DIVIDER_CLASS} />
			<Popover
				open={isOpen}
				onOpenChange={(open) => {
					setIsOpen(open);
					// Radix closes the list on the outside click, after the list that this click opened took the focus.
					if (!open) {
						onListClose(
							listContentRef.current?.contains(document.activeElement) ?? false,
						);
					}
				}}
			>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="mx-1 flex h-8 min-w-0 items-center gap-1 rounded-full px-2.5 font-semibold text-night outline-offset-0 transition-colors hover:bg-night/[0.05] focus-visible:outline-2 focus-visible:outline-ember aria-expanded:bg-night/[0.06] dark:text-foreground dark:aria-expanded:bg-white/[0.08] dark:hover:bg-white/[0.06]"
					>
						<span dir="auto" className="truncate">
							{field.valueLabel ?? t("leads.filters.choose")}
						</span>
						<CaretDownIcon
							aria-hidden
							weight="bold"
							className="size-3 shrink-0 text-night/45 dark:text-foreground/45"
						/>
					</button>
				</PopoverTrigger>
				<PopoverContent
					ref={listContentRef}
					align="start"
					className={cn("w-64 p-0", CLOSING_LIST_CLASS)}
					onOpenAutoFocus={(event) => {
						// With no search field, Radix would focus the sheet, and cmdk would not get the arrow keys.
						if (!field.searchPlaceholder) {
							event.preventDefault();
							commandRef.current?.focus();
						}
					}}
				>
					<Command ref={commandRef} filter={matchLabel} label={field.label}>
						{field.searchPlaceholder ? (
							<CommandInput placeholder={field.searchPlaceholder} />
						) : null}
						<CommandList>
							<CommandEmpty>{t("leads.filters.noMatch")}</CommandEmpty>
							{field.options.map((option) => (
								<CommandItem
									key={option.id}
									value={option.id}
									keywords={[option.label]}
									onSelect={() => {
										onPick(option.next);
										if (!option.keepsListOpen) setIsOpen(false);
									}}
								>
									{option.dotClass ? (
										<span
											aria-hidden
											className={cn(
												"size-2 shrink-0 rounded-full",
												option.dotClass,
											)}
										/>
									) : null}
									<span dir="auto" className="min-w-0 truncate">
										{option.label}
									</span>
									{option.id === field.selectedId ? (
										<CheckIcon
											aria-hidden
											weight="bold"
											className="ms-auto size-4 shrink-0 text-primary"
										/>
									) : null}
								</CommandItem>
							))}
						</CommandList>
					</Command>
					{field.footer}
				</PopoverContent>
			</Popover>
			<span aria-hidden className={DIVIDER_CLASS} />
			<button
				type="button"
				onClick={onRemove}
				aria-label={t("leads.filters.remove", { filter: field.label })}
				className="mx-1 grid size-8 shrink-0 place-items-center rounded-full text-night/45 outline-offset-0 transition-colors hover:bg-night/[0.05] hover:text-night focus-visible:outline-2 focus-visible:outline-ember dark:text-foreground/45 dark:hover:bg-white/[0.06] dark:hover:text-foreground"
			>
				<XIcon weight="bold" className="size-3.5" />
			</button>
		</fieldset>
	);
}
