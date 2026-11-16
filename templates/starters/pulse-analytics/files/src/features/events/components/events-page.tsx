// The Events page behind login: the summary strip, the event catalog beside the detail of one event, and the stream.
// The /app/events route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period and the chosen event. The catalog and the detail read again when one of them changes.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DEFAULT_DAYS,
	dayCountFormat,
	type EventKey,
	fillMessage,
	PanelError,
	type PeriodDays,
	PeriodTabs,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DEFAULT_EVENT,
	eventCatalogQueryOptions,
	eventStreamQueryOptions,
} from "../api/events.queries";
import { EventCatalogCard } from "./event-catalog-card";
import { EventDetailCard } from "./event-detail-card";
import { EventStreamCard } from "./event-stream-card";
import { EventSummaryStrip } from "./event-summary-strip";

/**
 * The catalog takes two of three columns from the 5xl container width: under it, the five columns of the table need the full width.
 * In one column the catalog comes first and the detail card follows it.
 */
const CATALOG_GRID = "grid grid-cols-1 items-start gap-6 @5xl/main:grid-cols-3";

/** The page. A click on an event name moves the detail card to that event. */
export function EventsPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const [selectedKey, setSelectedKey] = useState<EventKey>(DEFAULT_EVENT);
	const detailRef = useRef<HTMLDivElement>(null);
	const catalog = useQuery({
		...eventCatalogQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const { data: stream } = useSuspenseQuery(eventStreamQueryOptions());
	const selected = catalog.data?.events.find(
		(event) => event.id === selectedKey,
	);

	function selectEvent(eventKey: EventKey) {
		setSelectedKey(eventKey);
		// In one column the detail card is under the catalog, so the page scrolls to it.
		// Beside the catalog the card is sticky and its top is in view, so the page stays.
		const detail = detailRef.current;
		if (!detail) {
			return;
		}
		const top = detail.getBoundingClientRect().top;
		if (top < 0 || top > window.innerHeight / 2) {
			const isReducedMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			detail.scrollIntoView({
				block: "start",
				behavior: isReducedMotion ? "auto" : "smooth",
			});
		}
	}

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("events.title")}
				description={fillMessage(t("events.description"), {
					period: dayCountFormat(locale).format(days),
				})}
				actions={<PeriodTabs days={days} onDaysChange={setDays} />}
			/>
			{catalog.isError ? (
				<PanelError
					message={t("events.loadError")}
					onRetry={() => catalog.refetch()}
					className="h-96"
				/>
			) : catalog.data === undefined ? (
				<CatalogSkeleton />
			) : (
				<>
					<EventSummaryStrip catalog={catalog.data} />
					<div className={CATALOG_GRID}>
						<div className="@5xl/main:col-span-2 grid grid-cols-1">
							<EventCatalogCard
								events={catalog.data.events}
								selectedKey={selectedKey}
								onSelect={selectEvent}
							/>
						</div>
						<div
							ref={detailRef}
							className="@5xl/main:sticky @5xl/main:top-18 grid scroll-mt-20 grid-cols-1"
						>
							{selected ? (
								<EventDetailCard event={selected} days={days} />
							) : null}
						</div>
					</div>
				</>
			)}
			<EventStreamCard events={stream} />
		</div>
	);
}

// The strip and the two cards of the catalog row while they load, in their final spans.
function CatalogSkeleton() {
	return (
		<>
			<Skeleton className="h-24 w-full" />
			<div className={CATALOG_GRID}>
				<Skeleton className="@5xl/main:col-span-2 h-160" />
				<Skeleton className="h-160" />
			</div>
		</>
	);
}

/** Placeholder while the Events loader runs. The route sets it as pendingComponent. */
export function EventsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64" />
			</div>
			<CatalogSkeleton />
			<Skeleton className="h-96 w-full" />
		</div>
	);
}

/** Error state of the Events page when the loader fails. Try again runs the loader again. */
export function EventsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("events.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
