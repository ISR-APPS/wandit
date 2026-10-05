/**
 * The four simulated apps that the landing page "builds": two mobile apps
 * (barber, running) and two web apps (invoices, yoga). Each one has its own
 * palette and renders at a fixed design size; FitScreen scales it. The same
 * DOM renders a grey skeleton, so WandSweep can line up both states.
 * The hero, how-it-works and languages sections import it. Text comes from
 * lib/mini-app-copy.ts.
 */

import type { TargetPlatform } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import {
	Activity,
	CalendarCheck,
	ChartColumn,
	ChevronRight,
	FileText,
	House,
	LayoutGrid,
	type LucideIcon,
	MessageCircle,
	Play,
	Plus,
	Search,
	Settings,
	Star,
	User,
	Users,
	Zap,
} from "lucide-react";

import { getDir, type Locale } from "@/lib/i18n";

import type { HeroIdeaId, IDEAS } from "../lib/constants";
import { MINI_APP_COPY } from "../lib/mini-app-copy";

/** Design size of a mini app screen in CSS px. Mobile is a 360 px wide phone screen. */
export const MINI_APP_SIZE = {
	mobile: { width: 360, height: 780 },
	web: { width: 960, height: 600 },
} as const satisfies Record<TargetPlatform, { width: number; height: number }>;

/** Platform of each hero app. The type check rejects a value that differs from IDEAS. */
export const MINI_APP_PLATFORM = {
	barber: "mobile",
	invoices: "web",
	running: "mobile",
	yoga: "web",
} as const satisfies {
	[Id in HeroIdeaId]: Extract<(typeof IDEAS)[number], { id: Id }>["platform"];
};

type MiniAppProps = {
	id: HeroIdeaId;
	/** Language of the app content. It can differ from the page locale. Arabic is RTL. */
	language: Locale;
	/** Renders the grey wireframe of the same screen, for the start of WandSweep. */
	skeleton?: boolean;
	/** Barber only. "gold" paints the book button gold: the edit demo of How it works. */
	bookAccent?: "default" | "gold";
};

/** Ground, ink and font of each app, on the root. The skeleton flattens the ground to grey. */
const APP_ROOT_CLASS = {
	barber: "bg-[#0f0f0f] font-grotesk text-[#f4efe6]",
	running: "bg-[#14161b] font-sans text-[#f2f4f7]",
	invoices: "bg-[#f7f7fb] font-sans text-[#16123a]",
	yoga: "bg-[#f3e9dc] font-sans text-[#1f3b2d]",
} as const satisfies Record<HeroIdeaId, string>;

/** The screen of one simulated app, without a device frame. Decorative: hidden from assistive tech. */
export function MiniApp({
	id,
	language,
	skeleton = false,
	bookAccent = "default",
}: MiniAppProps) {
	const size = MINI_APP_SIZE[MINI_APP_PLATFORM[id]];
	const isRtl = getDir(language) === "rtl";

	return (
		<div
			aria-hidden="true"
			lang={language}
			dir={getDir(language)}
			data-skeleton={skeleton ? "" : undefined}
			className={cn(
				"group/app relative select-none overflow-hidden data-skeleton:bg-[#eef0f5]",
				APP_ROOT_CLASS[id],
			)}
			style={{ width: size.width, height: size.height }}
		>
			{id === "barber" ? (
				<BarberApp language={language} isRtl={isRtl} bookAccent={bookAccent} />
			) : null}
			{id === "running" ? (
				<RunningApp language={language} isRtl={isRtl} />
			) : null}
			{id === "invoices" ? (
				<InvoicesApp language={language} isRtl={isRtl} />
			) : null}
			{id === "yoga" ? <YogaApp language={language} isRtl={isRtl} /> : null}
		</div>
	);
}

/** Props that every app screen gets from MiniApp. */
type AppScreenProps = {
	language: Locale;
	/** True for Arabic. Mirrors the chevrons and picks fonts with Arabic glyphs. */
	isRtl: boolean;
};

/*
 * Skeleton look. MiniApp sets data-skeleton on its root; these classes then
 * turn the same boxes into a flat grey wireframe. Every text node is a span
 * sized to its text, so its grey bar has the width of the words.
 */
const SKELETON_TEXT =
	"box-decoration-clone group-data-skeleton/app:rounded-full group-data-skeleton/app:bg-[#d5d9e3] group-data-skeleton/app:text-transparent group-data-skeleton/app:decoration-transparent";
const SKELETON_FILL =
	"group-data-skeleton/app:border-transparent group-data-skeleton/app:bg-[#e2e5ec] group-data-skeleton/app:bg-none group-data-skeleton/app:shadow-none";
/** A fill that sits on another fill, so it needs a darker grey to show. */
const SKELETON_FILL_DEEP =
	"group-data-skeleton/app:border-transparent group-data-skeleton/app:bg-[#d5d9e3] group-data-skeleton/app:bg-none group-data-skeleton/app:shadow-none";
const SKELETON_ICON =
	"group-data-skeleton/app:rounded-[5px] group-data-skeleton/app:bg-[#d5d9e3] group-data-skeleton/app:text-transparent";
const SKELETON_HIDE_TEXT = "group-data-skeleton/app:text-transparent";
const SKELETON_LINE = "group-data-skeleton/app:border-[#e2e5ec]";
const SKELETON_HIDE = "group-data-skeleton/app:invisible";

/** iOS status bar: time on the start side, signal, wifi and battery on the end side. */
function StatusBar() {
	return (
		<div className="flex h-[50px] items-center justify-between px-[30px] pt-[5px]">
			<span
				className={cn("font-semibold text-[15px] tabular-nums", SKELETON_TEXT)}
			>
				9:41
			</span>
			<svg
				aria-hidden="true"
				viewBox="0 0 68 13"
				className={cn("h-[13px] w-[68px] fill-current", SKELETON_ICON)}
			>
				<path d="M1 9h3v3.5H1zM6 6.5h3v6H6zM11 4h3v8.5h-3zM16 1.5h3v11h-3z" />
				<path
					d="M24.6 5.4a8.4 8.4 0 0 1 11.8 0M27.1 8a4.8 4.8 0 0 1 6.8 0"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.7"
					strokeLinecap="round"
				/>
				<circle cx="30.5" cy="11" r="1.4" />
				<rect
					x="42.5"
					y="1"
					width="22"
					height="11.5"
					rx="3.4"
					fill="none"
					stroke="currentColor"
					strokeOpacity="0.45"
				/>
				<rect x="44.5" y="3" width="16" height="7.5" rx="1.8" />
			</svg>
		</div>
	);
}

type SectionTitleProps = {
	title: string;
	/** Short text on the end side of the row, like a month or a "see all" link. */
	aside: string;
	/** Color classes of `aside`. */
	asideClass: string;
	/** Adds a chevron after `aside`, for a link. */
	isLink?: boolean;
	/** Mirrors the chevron for Arabic. */
	isRtl?: boolean;
};

/** Title row of a block in the two mobile apps. */
function SectionTitle({
	title,
	aside,
	asideClass,
	isLink = false,
	isRtl = false,
}: SectionTitleProps) {
	return (
		<div className="mt-5 flex items-center justify-between px-5">
			<span
				className={cn(
					"font-semibold text-[17px] tracking-[-0.01em]",
					SKELETON_TEXT,
				)}
			>
				{title}
			</span>
			<span
				className={cn(
					"flex items-center gap-0.5 font-medium text-[13px]",
					asideClass,
				)}
			>
				<span className={SKELETON_TEXT}>{aside}</span>
				{isLink ? (
					<ChevronRight
						className={cn("size-3.5", isRtl && "-scale-x-100", SKELETON_ICON)}
						strokeWidth={2.4}
					/>
				) : null}
			</span>
		</div>
	);
}

type TabBarProps = {
	labels: readonly [string, string, string, string];
	icons: readonly [LucideIcon, LucideIcon, LucideIcon, LucideIcon];
	/** Ground, border and idle ink of the bar. */
	className: string;
	/** Ink of the first tab, which is the active one. */
	activeClass: string;
};

/** Bottom tab bar of a mobile app, with the iOS home indicator. */
function TabBar({ labels, icons, className, activeClass }: TabBarProps) {
	return (
		<div
			className={cn(
				"absolute inset-x-0 bottom-0 grid grid-cols-4 border-t px-3 pt-2.5 pb-[30px] group-data-skeleton/app:bg-[#eef0f5]",
				className,
				SKELETON_LINE,
			)}
		>
			{labels.map((label, index) => {
				const Icon = icons[index];
				return (
					<span
						key={label}
						className={cn(
							"flex flex-col items-center gap-1",
							index === 0 && activeClass,
						)}
					>
						<Icon
							className={cn("size-[23px]", SKELETON_ICON)}
							strokeWidth={index === 0 ? 2.2 : 1.8}
						/>
						<span className={cn("font-medium text-[10.5px]", SKELETON_TEXT)}>
							{label}
						</span>
					</span>
				);
			})}
			<span className="absolute bottom-2 left-1/2 h-[5px] w-[132px] -translate-x-1/2 rounded-full bg-current opacity-80 group-data-skeleton/app:bg-[#c9cdd8]" />
		</div>
	);
}

/* ---------------------------------------------------------------- barber */

/** Day numbers of the five date chips, Monday 5 to Friday 9 October 2026. */
const BARBER_FIRST_DAY = 5;
/** Index in the weekdays of the copy, not a day number: Wednesday 7. */
const BARBER_SELECTED_DAY_INDEX = 2;

/**
 * Time grid of the barber app. "taken" slots belong to other clients. The
 * open and selected slots make the "5 free" of the copy.
 */
const BARBER_SLOTS = [
	{ time: "10:00", state: "open" },
	{ time: "10:30", state: "taken" },
	{ time: "11:00", state: "open" },
	{ time: "13:00", state: "taken" },
	{ time: "14:00", state: "open" },
	{ time: "14:30", state: "selected" },
	{ time: "15:30", state: "open" },
	{ time: "16:00", state: "taken" },
] as const;

const BARBER_SLOT_CLASS = {
	open: "border-[#262626] bg-[#171717]",
	taken: "border-[#1d1d1d] bg-transparent text-[#57524b]",
	selected:
		"border-[#d4a24c] bg-[#d4a24c]/14 text-[#ebc274] shadow-[0_0_0_3px_rgba(212,162,76,0.12)]",
} as const;

/** Avatar grounds of the two barbers, in the order of the copy. */
const BARBER_AVATAR_CLASS = [
	"bg-[linear-gradient(140deg,#f0cf8c,#b07a2c)] text-[#1a1206]",
	"bg-[linear-gradient(140deg,#6b6b6b,#2b2b2b)] text-[#f4efe6]",
] as const;

const BARBER_TAB_ICONS = [House, CalendarCheck, MessageCircle, User] as const;

type BarberAppProps = AppScreenProps & {
	bookAccent: "default" | "gold";
};

function BarberApp({ language, isRtl, bookAccent }: BarberAppProps) {
	const copy = MINI_APP_COPY[language].barber;

	return (
		<>
			<StatusBar />
			<div className="flex items-center justify-between px-5 pt-2">
				<div className="flex flex-col items-start gap-1.5">
					<span className={cn("text-[#8f887d] text-[13.5px]", SKELETON_TEXT)}>
						{copy.greeting}
					</span>
					<span
						className={cn(
							"font-extrabold font-stretch-condensed text-[34px] leading-none tracking-[-0.01em]",
							SKELETON_TEXT,
						)}
					>
						Fade Studio
					</span>
				</div>
				<span
					className={cn(
						"grid size-12 place-items-center rounded-full border border-[#d4a24c]/50 bg-[#1c1913] font-bold text-[#e8c37a] text-[14px]",
						SKELETON_FILL,
						SKELETON_HIDE_TEXT,
					)}
				>
					{copy.clientInitials}
				</span>
			</div>

			<SectionTitle
				title={copy.pickDay}
				aside={copy.month}
				asideClass="text-[#8f887d]"
			/>
			<div className="mt-3 flex gap-2 px-5">
				{copy.weekdays.map((weekday, index) => {
					const isSelected = index === BARBER_SELECTED_DAY_INDEX;
					return (
						<span
							key={weekday}
							className={cn(
								"flex h-[72px] flex-1 flex-col items-center justify-center gap-1.5 rounded-[20px] border",
								isSelected
									? "border-[#d4a24c] bg-[#d4a24c] text-[#140f06] shadow-[0_10px_24px_-10px_rgba(212,162,76,0.7)]"
									: "border-[#262626] bg-[#171717]",
								SKELETON_FILL,
							)}
						>
							<span
								className={cn(
									"font-medium text-[11px]",
									isSelected ? "text-[#140f06]/70" : "text-[#8f887d]",
									SKELETON_TEXT,
								)}
							>
								{weekday}
							</span>
							<span
								className={cn(
									"font-bold text-[22px] tabular-nums leading-none",
									SKELETON_TEXT,
								)}
							>
								{BARBER_FIRST_DAY + index}
							</span>
						</span>
					);
				})}
			</div>

			<SectionTitle
				title={copy.pickTime}
				aside={copy.freeSlots}
				asideClass="text-[#d4a24c]"
			/>
			<div className="mt-3 grid grid-cols-4 gap-2 px-5">
				{BARBER_SLOTS.map((slot) => (
					<span
						key={slot.time}
						className={cn(
							"flex h-[44px] items-center justify-center rounded-[14px] border font-semibold text-[14.5px] tabular-nums",
							BARBER_SLOT_CLASS[slot.state],
							SKELETON_FILL,
						)}
					>
						<span
							className={cn(
								slot.state === "taken" &&
									"line-through decoration-[#57524b] decoration-[1.5px]",
								SKELETON_TEXT,
							)}
						>
							{slot.time}
						</span>
					</span>
				))}
			</div>

			<SectionTitle
				title={copy.pickBarber}
				aside={copy.seeAll}
				asideClass="text-[#d4a24c]"
				isLink
				isRtl={isRtl}
			/>
			<div className="mt-3 grid grid-cols-2 gap-2 px-5">
				{copy.barbers.map((barber, index) => (
					<div
						key={barber.name}
						className={cn(
							"flex flex-col items-start rounded-[22px] border p-3.5",
							index === 0
								? "border-[#d4a24c]/60 bg-[linear-gradient(160deg,#211b10,#151310)]"
								: "border-[#262626] bg-[#171717]",
							SKELETON_FILL,
						)}
					>
						<div className="flex w-full items-center justify-between">
							<span
								className={cn(
									"grid size-11 place-items-center rounded-full font-bold text-[14px]",
									BARBER_AVATAR_CLASS[index],
									SKELETON_FILL_DEEP,
									SKELETON_HIDE_TEXT,
								)}
							>
								{barber.initials}
							</span>
							<span
								className={cn(
									"flex items-center gap-1 rounded-full bg-[#262420] px-2 py-1 font-semibold text-[12px]",
									SKELETON_FILL_DEEP,
								)}
							>
								<Star
									className={cn(
										"size-3 fill-current text-[#d4a24c]",
										SKELETON_ICON,
									)}
									strokeWidth={0}
								/>
								<span className={cn("tabular-nums", SKELETON_HIDE_TEXT)}>
									{barber.rating}
								</span>
							</span>
						</div>
						<span className={cn("mt-3 font-bold text-[16px]", SKELETON_TEXT)}>
							{barber.name}
						</span>
						<span
							className={cn("mt-1 text-[#8f887d] text-[12.5px]", SKELETON_TEXT)}
						>
							{barber.specialty}
						</span>
					</div>
				))}
			</div>

			<div
				className={cn(
					"mx-5 mt-5 flex h-[60px] items-center justify-between rounded-full ps-7 pe-6 text-[#140f06] transition-[background-color,box-shadow] duration-700",
					bookAccent === "gold"
						? "bg-[#d4a24c] shadow-[0_14px_34px_-12px_rgba(212,162,76,0.85)]"
						: "bg-[#f4efe6] shadow-[0_14px_34px_-14px_rgba(244,239,230,0.35)]",
					SKELETON_FILL,
				)}
			>
				<span
					className={cn("font-bold text-[17px] tabular-nums", SKELETON_TEXT)}
				>
					{copy.book}
				</span>
				<span
					className={cn(
						"font-semibold text-[#140f06]/55 text-[14px] tabular-nums",
						SKELETON_TEXT,
					)}
				>
					{copy.price}
				</span>
			</div>

			<TabBar
				labels={copy.tabs}
				icons={BARBER_TAB_ICONS}
				className="border-[#1c1c1c] bg-[#0f0f0f]/95 text-[#6f6a63]"
				activeClass="text-[#d4a24c]"
			/>
		</>
	);
}

/* --------------------------------------------------------------- running */

/**
 * Distance per day this week, Monday to Sunday, in km. The sum is the
 * 32.4 km of the card. Friday is today; the weekend is still empty.
 */
const RUN_WEEK = [
	{ id: "mon", km: 6.2 },
	{ id: "tue", km: 8.4 },
	{ id: "wed", km: 0 },
	{ id: "thu", km: 5.6 },
	{ id: "fri", km: 12.2 },
	{ id: "sat", km: 0 },
	{ id: "sun", km: 0 },
] as const;
const RUN_TODAY = "fri";
/** Bar height in px of the longest day. An empty day keeps a 6 px stub. */
const RUN_BAR_MAX_PX = 62;
/** Distance of the longest day in km. Its bar gets RUN_BAR_MAX_PX, so no bar leaves the 84 px row. */
const RUN_LONGEST_KM = Math.max(...RUN_WEEK.map((day) => day.km));

/** Avatar grounds of the three runners, in the order of the copy. */
const RUNNER_CLASS = ["bg-[#ff9a62]", "bg-[#8fd0ff]", "bg-[#c6f432]"] as const;

const RUNNING_TAB_ICONS = [House, Activity, Users, User] as const;

function RunningApp({ language, isRtl }: AppScreenProps) {
	const copy = MINI_APP_COPY[language].running;

	return (
		<>
			<StatusBar />
			<div className="flex items-center justify-between px-5 pt-2">
				<div className="flex items-center gap-3">
					<span
						className={cn(
							"grid size-11 place-items-center rounded-[14px] bg-[#c6f432] text-[#14161b]",
							SKELETON_FILL,
						)}
					>
						<Zap
							className={cn("size-[22px] fill-current", SKELETON_ICON)}
							strokeWidth={0}
						/>
					</span>
					<div className="flex flex-col items-start gap-1">
						<span
							className={cn(
								"font-extrabold font-grotesk text-[23px] leading-none tracking-[-0.03em]",
								SKELETON_TEXT,
							)}
						>
							Pace Club
						</span>
						<span className={cn("text-[#8b919c] text-[12.5px]", SKELETON_TEXT)}>
							{copy.club}
						</span>
					</div>
				</div>
				<div className="flex -space-x-2.5">
					{copy.runs.map((run, index) => (
						<span
							key={run.name}
							className={cn(
								"grid size-9 place-items-center rounded-full border-[#14161b] border-[2.5px] font-bold text-[#14161b] text-[12.5px]",
								RUNNER_CLASS[index],
								SKELETON_FILL,
								SKELETON_HIDE_TEXT,
							)}
						>
							{run.initial}
						</span>
					))}
				</div>
			</div>

			<div
				className={cn(
					"mx-5 mt-4 rounded-[28px] border border-[#252932] bg-[#1b1e25] bg-[radial-gradient(90%_70%_at_88%_0%,rgba(198,244,50,0.17),transparent_70%)] p-[18px]",
					SKELETON_FILL,
				)}
			>
				<div className="flex items-center justify-between">
					<span
						className={cn(
							"font-medium text-[#a3a9b4] text-[13.5px]",
							SKELETON_TEXT,
						)}
					>
						{copy.week}
					</span>
					<span
						dir="ltr"
						className={cn(
							"rounded-full bg-[#c6f432]/15 px-2.5 py-1 font-bold text-[#c6f432] text-[12px] tabular-nums",
							SKELETON_FILL_DEEP,
							SKELETON_HIDE_TEXT,
						)}
					>
						{copy.trend}
					</span>
				</div>
				<div className="mt-3 flex items-end justify-between">
					<span className="flex items-baseline gap-2">
						<span
							className={cn(
								"font-extrabold font-grotesk text-[60px] tabular-nums leading-[0.9] tracking-[-0.045em]",
								SKELETON_TEXT,
							)}
						>
							{copy.total}
						</span>
						<span
							className={cn(
								"font-grotesk font-semibold text-[#8b919c] text-[20px]",
								SKELETON_TEXT,
							)}
						>
							{copy.unit}
						</span>
					</span>
					<span className="flex w-[104px] flex-col items-end gap-2 pb-1.5">
						<span className={cn("text-[#8b919c] text-[12px]", SKELETON_TEXT)}>
							{copy.goal}
						</span>
						<span
							className={cn(
								"flex h-[6px] w-full overflow-hidden rounded-full bg-[#2c313b]",
								SKELETON_FILL_DEEP,
							)}
						>
							{/* 32.4 of 40 km. */}
							<span className="h-full w-[81%] rounded-full bg-[#c6f432] group-data-skeleton/app:bg-[#c3c8d4]" />
						</span>
					</span>
				</div>
				<div className="mt-4 flex h-[84px] items-end gap-2.5">
					{RUN_WEEK.map((day, index) => {
						const isToday = day.id === RUN_TODAY;
						return (
							<div
								key={day.id}
								className="flex h-full flex-1 flex-col items-center justify-end gap-2"
							>
								<span
									className={cn(
										"w-full rounded-[9px]",
										isToday
											? "bg-[#c6f432] shadow-[0_0_24px_-4px_rgba(198,244,50,0.6)]"
											: "bg-[#2e333d]",
										SKELETON_FILL_DEEP,
									)}
									style={{
										height: Math.max(
											6,
											(day.km / RUN_LONGEST_KM) * RUN_BAR_MAX_PX,
										),
									}}
								/>
								<span
									className={cn(
										"font-semibold text-[11px]",
										isToday ? "text-[#f2f4f7]" : "text-[#6c727d]",
										SKELETON_TEXT,
									)}
								>
									{copy.dayLetters[index]}
								</span>
							</div>
						);
					})}
				</div>
			</div>

			<SectionTitle
				title={copy.clubRuns}
				aside={copy.seeAll}
				asideClass="text-[#c6f432]"
				isLink
				isRtl={isRtl}
			/>
			<div className="mt-1 flex flex-col px-5">
				{copy.runs.map((run, index) => (
					<div
						key={run.name}
						className={cn(
							"flex items-center gap-3 border-[#22252d] border-b py-2.5 last:border-b-0",
							SKELETON_LINE,
						)}
					>
						<span
							className={cn(
								"grid size-10 shrink-0 place-items-center rounded-full font-bold text-[#14161b] text-[15px]",
								RUNNER_CLASS[index],
								SKELETON_FILL,
								SKELETON_HIDE_TEXT,
							)}
						>
							{run.initial}
						</span>
						<div className="flex min-w-0 flex-1 flex-col items-start gap-1">
							<span
								className={cn("font-semibold text-[15.5px]", SKELETON_TEXT)}
							>
								{run.name}
							</span>
							<span
								className={cn("text-[#8b919c] text-[12.5px]", SKELETON_TEXT)}
							>
								{run.when}
							</span>
						</div>
						<div className="flex flex-col items-end gap-1">
							<span
								className={cn(
									"font-bold font-grotesk text-[16px] tabular-nums",
									SKELETON_TEXT,
								)}
							>
								{run.distance}
							</span>
							<span
								className={cn(
									"text-[#8b919c] text-[12.5px] tabular-nums",
									SKELETON_TEXT,
								)}
							>
								{run.pace}
							</span>
						</div>
					</div>
				))}
			</div>

			<div
				className={cn(
					"mx-5 mt-3 flex h-[56px] items-center justify-center gap-2.5 rounded-full bg-[#c6f432] font-bold text-[#14161b] text-[17px] shadow-[0_14px_34px_-12px_rgba(198,244,50,0.55)]",
					SKELETON_FILL,
				)}
			>
				<Play className={cn("size-[17px] fill-current", SKELETON_ICON)} />
				<span className={SKELETON_TEXT}>{copy.start}</span>
			</div>

			<TabBar
				labels={copy.tabs}
				icons={RUNNING_TAB_ICONS}
				className="border-[#20232a] bg-[#14161b]/95 text-[#6c727d]"
				activeClass="text-[#c6f432]"
			/>
		</>
	);
}

/* -------------------------------------------------------------- invoices */

/** Sidebar items, in the order of copy.nav. */
const INVOICE_NAV = [
	{ id: "dashboard", Icon: LayoutGrid },
	{ id: "invoices", Icon: FileText },
	{ id: "clients", Icon: Users },
	{ id: "reports", Icon: ChartColumn },
	{ id: "settings", Icon: Settings },
] as const;

const INVOICE_STATUS_CLASS = {
	paid: "bg-[#e5f6ec] text-[#13804a]",
	pending: "bg-[#fff3dc] text-[#9a5b0b]",
	overdue: "bg-[#fde7eb] text-[#b8233c]",
} as const;

/** Look of the three KPI tiles, in display order. `id` keys copy.kpis, so tsc checks the pairing. */
const KPI_TONES = [
	{
		id: "paid",
		tile: "border-transparent bg-[#6d4aff] text-white shadow-[0_18px_40px_-18px_rgba(109,74,255,0.75)] after:absolute after:-end-10 after:-top-12 after:size-36 after:rounded-full after:border-[22px] after:border-white/10 group-data-skeleton/app:after:hidden",
		label: "text-white/80",
		note: "bg-white/18 text-white",
	},
	{
		id: "pending",
		tile: "border-[#ecebf3] bg-white",
		label: "text-[#6b6886]",
		note: INVOICE_STATUS_CLASS.pending,
	},
	{
		id: "overdue",
		tile: "border-[#ecebf3] bg-white",
		label: "text-[#6b6886]",
		note: INVOICE_STATUS_CLASS.overdue,
	},
] as const;

/** Avatar grounds of the five clients, in the order of the copy rows. */
const CLIENT_CLASS = [
	"bg-[#efeaff] text-[#5b37f0]",
	"bg-[#ffe6d9] text-[#a4471a]",
	"bg-[#dff3ff] text-[#16679a]",
	"bg-[#fde7eb] text-[#a5203a]",
	"bg-[#e5f6ec] text-[#13804a]",
] as const;

/** Cash in per month, May to October, as a bar height in px. October is the current month. */
const CASH_MONTHS = [
	{ id: "may", height: 70 },
	{ id: "jun", height: 92 },
	{ id: "jul", height: 64 },
	{ id: "aug", height: 108 },
	{ id: "sep", height: 96 },
	{ id: "oct", height: 138 },
] as const;
const CASH_CURRENT_MONTH = "oct";

/** Shared column widths of the invoice table header and rows. */
const INVOICE_GRID =
	"grid grid-cols-[1.6fr_0.95fr_1fr_1.15fr] items-center justify-items-start";

function InvoicesApp({ language }: AppScreenProps) {
	const copy = MINI_APP_COPY[language].invoices;

	return (
		<div className="flex h-full">
			<div
				className={cn(
					"flex w-[212px] shrink-0 flex-col border-[#ecebf3] border-e bg-white px-4 py-5 group-data-skeleton/app:bg-[#f4f5f8]",
					SKELETON_LINE,
				)}
			>
				<div className="flex items-center gap-2.5 px-2">
					<span
						className={cn(
							"grid size-8 place-items-center rounded-[10px] bg-[linear-gradient(140deg,#8a6bff,#5a33f5)] font-bold font-grotesk text-[17px] text-white",
							SKELETON_FILL,
							SKELETON_HIDE_TEXT,
						)}
					>
						L
					</span>
					<span
						className={cn(
							"font-bold font-grotesk text-[19px] tracking-[-0.03em]",
							SKELETON_TEXT,
						)}
					>
						Ledgerly
					</span>
				</div>
				<div className="mt-8 flex flex-col gap-1">
					{INVOICE_NAV.map(({ id, Icon }, index) => (
						<span
							key={id}
							className={cn(
								"flex h-10 items-center gap-3 rounded-xl px-3 font-medium text-[14px]",
								index === 0
									? cn("bg-[#f1edff] text-[#5b37f0]", SKELETON_FILL)
									: "text-[#6b6886]",
							)}
						>
							<Icon
								className={cn("size-[18px]", SKELETON_ICON)}
								strokeWidth={index === 0 ? 2.2 : 1.9}
							/>
							<span className={SKELETON_TEXT}>{copy.nav[index]}</span>
						</span>
					))}
				</div>
				<div
					className={cn(
						"mt-auto flex items-center gap-2.5 rounded-2xl border border-[#ecebf3] p-2.5",
						SKELETON_FILL,
					)}
				>
					<span
						className={cn(
							"grid size-9 shrink-0 place-items-center rounded-full bg-[#ffd9c4] font-bold text-[#8a3b12] text-[13px]",
							SKELETON_FILL_DEEP,
							SKELETON_HIDE_TEXT,
						)}
					>
						{copy.userInitials}
					</span>
					<div className="flex min-w-0 flex-col items-start gap-0.5">
						<span className={cn("font-semibold text-[13px]", SKELETON_TEXT)}>
							{copy.userName}
						</span>
						<span className={cn("text-[#8b88a3] text-[12px]", SKELETON_TEXT)}>
							{copy.userRole}
						</span>
					</div>
				</div>
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-5 px-7 py-6">
				<div className="flex items-center justify-between">
					<div className="flex flex-col items-start gap-1.5">
						<span
							className={cn(
								"font-bold font-grotesk text-[26px] leading-none tracking-[-0.03em]",
								SKELETON_TEXT,
							)}
						>
							{copy.title}
						</span>
						<span className={cn("text-[#8b88a3] text-[13px]", SKELETON_TEXT)}>
							{copy.period}
						</span>
					</div>
					<div className="flex items-center gap-2.5">
						<span
							className={cn(
								"flex h-10 w-[220px] items-center gap-2 rounded-xl border border-[#e6e5ef] bg-white px-3 text-[#9a97b0] text-[13px]",
								SKELETON_FILL,
							)}
						>
							<Search
								className={cn("size-4", SKELETON_ICON)}
								strokeWidth={2.2}
							/>
							<span className={SKELETON_TEXT}>{copy.search}</span>
						</span>
						<span
							className={cn(
								"flex h-10 items-center gap-1.5 rounded-xl bg-[#6d4aff] px-4 font-semibold text-[13px] text-white shadow-[0_8px_20px_-8px_rgba(109,74,255,0.8)]",
								SKELETON_FILL,
							)}
						>
							<Plus className={cn("size-4", SKELETON_ICON)} strokeWidth={2.6} />
							<span className={SKELETON_TEXT}>{copy.newInvoice}</span>
						</span>
					</div>
				</div>

				<div className="grid grid-cols-3 gap-4">
					{KPI_TONES.map((tone) => {
						const kpi = copy.kpis[tone.id];
						return (
							<div
								key={tone.id}
								className={cn(
									"relative flex flex-col items-start overflow-hidden rounded-[20px] border p-4",
									tone.tile,
									SKELETON_FILL,
								)}
							>
								<span
									className={cn(
										"font-medium text-[13px]",
										tone.label,
										SKELETON_TEXT,
									)}
								>
									{kpi.label}
								</span>
								<span
									className={cn(
										"mt-2.5 font-bold font-grotesk text-[29px] tabular-nums leading-none tracking-[-0.035em]",
										SKELETON_TEXT,
									)}
								>
									{kpi.amount}
								</span>
								<span
									className={cn(
										"mt-3.5 rounded-full px-2 py-0.5 font-semibold text-[11.5px]",
										tone.note,
										SKELETON_FILL_DEEP,
										SKELETON_HIDE_TEXT,
									)}
								>
									{kpi.note}
								</span>
							</div>
						);
					})}
				</div>

				<div className="grid min-h-0 flex-1 grid-cols-[1fr_236px] gap-4">
					<div
						className={cn(
							"flex flex-col rounded-[20px] border border-[#ecebf3] bg-white px-4 pt-3.5",
							SKELETON_FILL,
						)}
					>
						<div className="flex items-center justify-between">
							<span className={cn("font-semibold text-[15px]", SKELETON_TEXT)}>
								{copy.recent}
							</span>
							<span
								className={cn(
									"font-semibold text-[#5b37f0] text-[13px]",
									SKELETON_TEXT,
								)}
							>
								{copy.viewAll}
							</span>
						</div>
						<div
							className={cn(
								INVOICE_GRID,
								"mt-3 border-[#f0eff5] border-b pb-2 font-medium text-[#8b88a3] text-[12px]",
								SKELETON_LINE,
							)}
						>
							{copy.columns.map((column) => (
								<span key={column} className={SKELETON_TEXT}>
									{column}
								</span>
							))}
						</div>
						{copy.rows.map((row, index) => (
							<div
								key={row.number}
								className={cn(
									INVOICE_GRID,
									"h-[45px] border-[#f4f3f8] border-b text-[13.5px] last:border-b-0",
									SKELETON_LINE,
								)}
							>
								<span className="flex items-center gap-2.5">
									<span
										className={cn(
											"grid size-7 place-items-center rounded-full font-bold text-[10.5px]",
											CLIENT_CLASS[index],
											SKELETON_FILL_DEEP,
											SKELETON_HIDE_TEXT,
										)}
									>
										{row.initials}
									</span>
									<span className={cn("font-medium", SKELETON_TEXT)}>
										{row.client}
									</span>
								</span>
								<span
									className={cn("text-[#8b88a3] tabular-nums", SKELETON_TEXT)}
								>
									{row.number}
								</span>
								<span
									className={cn("font-semibold tabular-nums", SKELETON_TEXT)}
								>
									{row.amount}
								</span>
								<span
									className={cn(
										"flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold text-[11.5px] before:size-1.5 before:rounded-full before:bg-current",
										INVOICE_STATUS_CLASS[row.status],
										SKELETON_FILL_DEEP,
										SKELETON_HIDE_TEXT,
									)}
								>
									{copy.statuses[row.status]}
								</span>
							</div>
						))}
					</div>

					<div
						className={cn(
							"flex flex-col items-start rounded-[20px] border border-[#ecebf3] bg-white p-4",
							SKELETON_FILL,
						)}
					>
						<span className={cn("font-semibold text-[15px]", SKELETON_TEXT)}>
							{copy.chartTitle}
						</span>
						<span
							className={cn(
								"mt-2.5 font-bold font-grotesk text-[25px] tabular-nums leading-none tracking-[-0.035em]",
								SKELETON_TEXT,
							)}
						>
							{copy.chartTotal}
						</span>
						<span
							className={cn("mt-2 text-[#8b88a3] text-[12px]", SKELETON_TEXT)}
						>
							{copy.chartNote}
						</span>
						<div className="mt-auto flex w-full items-end gap-2.5">
							{CASH_MONTHS.map((month, index) => (
								<div
									key={month.id}
									className="flex flex-1 flex-col items-center gap-2"
								>
									<span
										className={cn(
											"w-full rounded-[8px]",
											month.id === CASH_CURRENT_MONTH
												? "bg-[linear-gradient(180deg,#8a6bff,#6d4aff)]"
												: "bg-[#ebe6ff]",
											SKELETON_FILL_DEEP,
										)}
										style={{ height: month.height }}
									/>
									<span
										className={cn(
											"text-[#8b88a3] text-[10.5px]",
											SKELETON_TEXT,
										)}
									>
										{copy.months[index]}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ yoga */

function YogaApp({ language, isRtl }: AppScreenProps) {
	const copy = MINI_APP_COPY[language].yoga;
	// The serif face has no Arabic glyphs, so Arabic keeps the display grotesk.
	const displayFont = isRtl ? "font-grotesk font-semibold" : "font-serif";

	return (
		<div className="flex h-full flex-col">
			<div className="flex h-[72px] shrink-0 items-center justify-between px-10">
				<span className="flex items-center gap-2.5">
					<span
						className={cn(
							"relative size-7 overflow-hidden rounded-full bg-[#c8553d] after:absolute after:inset-x-0 after:bottom-0 after:h-[42%] after:bg-[#1f3b2d] group-data-skeleton/app:after:hidden",
							SKELETON_FILL,
						)}
					/>
					<span
						className={cn(
							"text-[22px] tracking-[-0.01em]",
							displayFont,
							SKELETON_TEXT,
						)}
					>
						Studio Sol
					</span>
				</span>
				<span className="flex items-center gap-8 text-[#1f3b2d]/75 text-[14px]">
					{copy.links.map((link) => (
						<span key={link} className={SKELETON_TEXT}>
							{link}
						</span>
					))}
				</span>
				<span
					className={cn(
						"flex h-10 items-center rounded-full bg-[#1f3b2d] px-5 font-semibold text-[#f3e9dc] text-[13.5px]",
						SKELETON_FILL,
					)}
				>
					<span className={SKELETON_TEXT}>{copy.book}</span>
				</span>
			</div>

			<div className="grid min-h-0 flex-1 grid-cols-[1.12fr_0.88fr] gap-8 px-10 pt-4">
				<div className="flex flex-col items-start">
					<span
						className={cn(
							"flex items-center gap-2 rounded-full border border-[#1f3b2d]/20 px-3 py-1.5 font-medium text-[12.5px] before:size-1.5 before:rounded-full before:bg-[#c8553d]",
							SKELETON_FILL,
							"group-data-skeleton/app:before:invisible",
						)}
					>
						<span className={SKELETON_TEXT}>{copy.eyebrow}</span>
					</span>
					<span
						className={cn(
							"mt-5",
							displayFont,
							isRtl
								? "text-[44px] leading-[1.3]"
								: "text-[56px] leading-[0.98] tracking-[-0.025em]",
							"text-balance",
						)}
					>
						<span className={SKELETON_TEXT}>{copy.headline}</span>
					</span>
					<span className="mt-5 max-w-[400px] text-pretty text-[#1f3b2d]/75 text-[16px] leading-[1.6]">
						<span className={SKELETON_TEXT}>{copy.body}</span>
					</span>
					<span className="mt-7 flex items-center gap-6">
						<span
							className={cn(
								"flex h-12 items-center rounded-full bg-[#c8553d] px-6 font-semibold text-[15px] text-white shadow-[0_14px_30px_-12px_rgba(200,85,61,0.8)]",
								SKELETON_FILL,
							)}
						>
							<span className={SKELETON_TEXT}>{copy.book}</span>
						</span>
						<span
							className={cn(
								"font-semibold text-[14.5px] underline decoration-2 decoration-[#c8553d] underline-offset-[6px]",
								SKELETON_TEXT,
							)}
						>
							{copy.schedule}
						</span>
					</span>
				</div>

				<div className="relative">
					<div
						className={cn(
							"absolute inset-y-0 start-[10%] end-0 overflow-hidden rounded-t-full bg-[#c8553d] p-[18px] pb-0",
							SKELETON_FILL,
						)}
					>
						<div
							className={cn(
								"relative h-full overflow-hidden rounded-t-full bg-[linear-gradient(180deg,#f7d9ae_0%,#efa577_62%,#e07f57_100%)]",
								SKELETON_FILL,
							)}
						>
							<span
								className={cn(
									"absolute top-[42%] left-1/2 size-[132px] -translate-x-1/2 rounded-full bg-[#fff2d6] shadow-[0_0_0_20px_rgba(255,242,214,0.28),0_0_0_44px_rgba(255,242,214,0.14)]",
									SKELETON_HIDE,
								)}
							/>
							<span
								className={cn(
									"absolute inset-x-0 bottom-0 h-[30%] bg-[#1f3b2d] before:absolute before:inset-x-[18%] before:top-[22%] before:h-[3px] before:rounded-full before:bg-[#f3e9dc]/30 after:absolute after:inset-x-[30%] after:top-[48%] after:h-[3px] after:rounded-full after:bg-[#f3e9dc]/20",
									SKELETON_HIDE,
								)}
							/>
						</div>
					</div>
					<div
						className={cn(
							"absolute start-0 bottom-6 flex items-center gap-3 rounded-[18px] bg-[#fbf6ef] p-3 pe-5 shadow-[0_20px_40px_-18px_rgba(31,59,45,0.45)]",
							SKELETON_FILL_DEEP,
						)}
					>
						<span
							className={cn(
								"grid size-10 place-items-center rounded-[12px] bg-[#1f3b2d] font-semibold text-[#f3e9dc] text-[12.5px] tabular-nums",
								SKELETON_FILL,
								SKELETON_HIDE_TEXT,
							)}
						>
							07:30
						</span>
						<span className="flex flex-col items-start gap-0.5">
							<span
								className={cn("text-[#1f3b2d]/60 text-[11.5px]", SKELETON_TEXT)}
							>
								{copy.nextLabel}
							</span>
							<span className={cn("font-semibold text-[15px]", SKELETON_TEXT)}>
								{copy.nextClass}
							</span>
							<span
								className={cn("text-[#c8553d] text-[11.5px]", SKELETON_TEXT)}
							>
								{copy.nextMeta}
							</span>
						</span>
					</div>
				</div>
			</div>

			<div
				className={cn(
					"mx-10 mt-6 mb-7 grid grid-cols-[110px_repeat(5,1fr)] items-center gap-2 rounded-[24px] bg-[#fbf6ef] p-2",
					SKELETON_FILL,
				)}
			>
				<span className="flex flex-col items-start gap-1 ps-3">
					<span
						className={cn(
							"font-semibold text-[14px] leading-tight",
							SKELETON_TEXT,
						)}
					>
						{copy.weekTitle}
					</span>
				</span>
				{copy.classes.map((item, index) => (
					<span
						key={item.day}
						className={cn(
							"flex flex-col items-start gap-0.5 rounded-[18px] px-3.5 py-3",
							index === 0
								? cn("bg-[#1f3b2d] text-[#f3e9dc]", SKELETON_FILL_DEEP)
								: "bg-transparent",
						)}
					>
						<span
							className={cn(
								"text-[11.5px]",
								index === 0 ? "text-[#f3e9dc]/70" : "text-[#1f3b2d]/60",
								SKELETON_TEXT,
							)}
						>
							{item.day}
						</span>
						<span
							className={cn(
								"font-semibold text-[17px] tabular-nums leading-tight",
								SKELETON_TEXT,
							)}
						>
							{item.time}
						</span>
						<span className={cn("text-[13px] leading-tight", SKELETON_TEXT)}>
							{item.name}
						</span>
						<span
							className={cn(
								"text-[11.5px]",
								index === 0 ? "text-[#f3e9dc]/70" : "text-[#1f3b2d]/60",
								SKELETON_TEXT,
							)}
						>
							{item.teacher}
						</span>
					</span>
				))}
			</div>
		</div>
	);
}
