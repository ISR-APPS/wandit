/**
 * The route button of the web preview address bar and its page list, like
 * the path picker of v0. WebPreview renders it. The list reads the file
 * routes of the app from codeSnapshotQuery through routesFromCodeTree. The
 * query runs only while the popover is open, because the list mounts then.
 */

import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { BrowserIcon } from "@phosphor-icons/react/Browser";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { HouseSimpleIcon } from "@phosphor-icons/react/HouseSimple";
import { LockSimpleIcon } from "@phosphor-icons/react/LockSimple";
import { PencilSimpleIcon } from "@phosphor-icons/react/PencilSimple";
import { useQuery } from "@tanstack/react-query";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@wandit/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useTranslation } from "@/lib/i18n";
import { codeSnapshotQuery } from "../../api/app-builder.queries";
import {
	type PreviewRoute,
	routesFromCodeTree,
} from "../../lib/preview-routes";

/** Props of the route button. WebPreview owns both paths. */
export type RoutePickerProps = {
	/** The project whose code snapshot lists the routes. */
	projectId: string;
	/** Pathname and query that the address bar shows, like `/invoices?page=2`. */
	currentPath: string;
	/** Loads one page in the frame. The path always starts with `/`. */
	onNavigate: (path: string) => void;
};

/** A pick closes the popover. A dynamic route only fills the input, so the user types the param first. */
export function RoutePicker({
	projectId,
	currentPath,
	onNavigate,
}: RoutePickerProps) {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={t("appBuilder.preview.routes.trigger", {
						path: currentPath,
					})}
					className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-full px-2.5 text-start outline-none transition-colors duration-150 hover:bg-night/[0.05] focus-visible:ring-2 focus-visible:ring-ring/50 aria-expanded:bg-night/[0.06] dark:aria-expanded:bg-white/[0.08] dark:hover:bg-white/[0.06]"
				>
					<LockSimpleIcon
						aria-hidden
						weight="bold"
						className="size-3.5 shrink-0 text-night/40 dark:text-foreground/40"
					/>
					{/* A path reads left to right in every locale. */}
					<span
						dir="ltr"
						className="min-w-0 truncate font-mono text-[13px] text-night/80 dark:text-foreground/80"
					>
						{currentPath}
					</span>
					<CaretDownIcon
						aria-hidden
						weight="bold"
						className="ms-auto size-3.5 shrink-0 text-night/45 dark:text-foreground/45"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={10}
				className="w-(--radix-popover-trigger-width) min-w-80 overflow-hidden p-0"
			>
				<RouteList
					projectId={projectId}
					currentPath={currentPath}
					onPick={(path) => {
						setIsOpen(false);
						onNavigate(path);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}

/** Props of the list inside the popover. */
type RouteListProps = Pick<RoutePickerProps, "projectId" | "currentPath"> & {
	/** Closes the popover and loads the path. */
	onPick: (path: string) => void;
};

function RouteList({ projectId, currentPath, onPick }: RouteListProps) {
	const { t } = useTranslation();
	// null data means the sandbox is asleep. A failed load also lists no route:
	// the user can still type a path, so the hint covers both.
	const snapshot = useQuery(codeSnapshotQuery(projectId));
	// The tree walk runs once per snapshot answer, not on every keystroke.
	const routes = useMemo(
		() => (snapshot.data ? routesFromCodeTree(snapshot.data.tree) : []),
		[snapshot.data],
	);
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const typedPath = query.trim();
	const matchingRoutes = routes.filter((route) =>
		route.path.toLowerCase().includes(typedPath.toLowerCase()),
	);
	// Only a typed path that starts with `/` can be a page; other text only searches the list.
	const canGoToTypedPath =
		typedPath.startsWith("/") &&
		!routes.some((route) => route.path === typedPath);
	// The check compares the page, so `/invoices?page=2` marks `/invoices`.
	const currentPage = currentPath.split(/[?#]/)[0];

	function pickRoute(route: PreviewRoute) {
		if (!route.isDynamic) {
			onPick(route.path);
			return;
		}
		// The input gets the pattern with its first param segment selected, so typing replaces it.
		const dollarIndex = route.path.indexOf("$");
		const segmentStart = route.path.lastIndexOf("/", dollarIndex) + 1;
		const nextSlash = route.path.indexOf("/", dollarIndex);
		const segmentEnd = nextSlash === -1 ? route.path.length : nextSlash;
		// The selection needs the new value in the DOM first.
		flushSync(() => setQuery(route.path));
		inputRef.current?.focus();
		inputRef.current?.setSelectionRange(segmentStart, segmentEnd);
	}

	return (
		<Command shouldFilter={false} label={t("appBuilder.preview.routes.pages")}>
			<CommandInput
				ref={inputRef}
				value={query}
				onValueChange={setQuery}
				placeholder={t("appBuilder.preview.routes.search")}
				// A typed path reads left to right; the empty field keeps the locale direction for the placeholder.
				dir={query === "" ? undefined : "auto"}
				className="font-mono text-[13px] placeholder:font-sans placeholder:text-sm"
			/>
			<CommandList>
				{canGoToTypedPath ? (
					<CommandItem
						value={`go-to:${typedPath}`}
						onSelect={() => onPick(typedPath)}
					>
						<ArrowRightIcon
							aria-hidden
							weight="bold"
							className="rtl:-scale-x-100"
						/>
						<span className="flex min-w-0 items-center gap-1.5">
							<span className="shrink-0">
								{t("appBuilder.preview.routes.goTo")}
							</span>
							<span
								dir="ltr"
								className="min-w-0 truncate font-mono font-normal text-[13px]"
							>
								{typedPath}
							</span>
						</span>
					</CommandItem>
				) : null}
				{snapshot.isPending ? (
					<div className="flex h-10 items-center gap-2.5 px-2.5 font-grotesk text-popover-foreground/55 text-sm">
						<CircleNotchIcon
							aria-hidden
							weight="bold"
							className="size-4 animate-spin text-primary motion-reduce:animate-none"
						/>
						{t("appBuilder.preview.routes.loading")}
					</div>
				) : matchingRoutes.length > 0 ? (
					<CommandGroup heading={t("appBuilder.preview.routes.pages")}>
						{matchingRoutes.map((route) => {
							const isCurrent = route.path === currentPage;
							return (
								<CommandItem
									key={route.path}
									value={route.path}
									// The check icon is hidden from screen readers, so the row names the current page.
									aria-current={isCurrent ? "page" : undefined}
									onSelect={() => pickRoute(route)}
									// The current page gets the spark tint of a picked kit row.
									className={
										isCurrent
											? "bg-spark/[0.14] data-[selected=true]:bg-spark/20"
											: undefined
									}
								>
									{route.path === "/" ? (
										<HouseSimpleIcon aria-hidden weight="bold" />
									) : (
										<BrowserIcon aria-hidden weight="bold" />
									)}
									<RoutePath path={route.path} />
									{isCurrent ? (
										<CheckIcon
											aria-hidden
											weight="bold"
											className="ms-auto size-4 shrink-0 text-primary"
										/>
									) : route.isDynamic ? (
										<PencilSimpleIcon
											aria-hidden
											weight="bold"
											className="ms-auto size-3.5 shrink-0 text-popover-foreground/35"
										/>
									) : null}
								</CommandItem>
							);
						})}
					</CommandGroup>
				) : canGoToTypedPath ? null : (
					<p className="flex flex-wrap items-center gap-1.5 px-2.5 py-3 font-sans text-popover-foreground/55 text-sm">
						{t("appBuilder.preview.routes.hint")}
						<code
							dir="ltr"
							className="rounded-md bg-popover-foreground/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-popover-foreground"
						>
							/about
						</code>
					</p>
				)}
			</CommandList>
		</Command>
	);
}

/** The path in mono. A `$param` segment takes the spark-deep color, so the part to type stands out. */
function RoutePath({ path }: { path: string }) {
	const segments = path.split("/").slice(1);
	return (
		<span
			dir="ltr"
			className="min-w-0 truncate font-mono font-normal text-[13px]"
		>
			{path === "/"
				? "/"
				: segments.map((segment, index) => (
						// The prefix up to this segment is unique inside one path, even for `/a/a`.
						<span key={segments.slice(0, index + 1).join("/")}>
							/
							<span
								className={
									segment.includes("$")
										? "text-spark-deep dark:text-spark"
										: undefined
								}
							>
								{segment}
							</span>
						</span>
					))}
		</span>
	);
}
