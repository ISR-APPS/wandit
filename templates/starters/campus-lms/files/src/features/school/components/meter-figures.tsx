// The KPI figures of the school in the meter form: each value as a share of its whole, with a bar, or a plain count.
// The Students page, the course page, and the Assignments page render them with their own figures.
// It follows the KPI form "meter" of the app-dashboard skill. The callers translate the labels.

import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { shareFormat } from "../lib/format";

// One decimal rounds 0.9996 up to "100%". A value under its whole stops at 99.9 %.
const MAX_SHARE_UNDER_WHOLE = 0.999;

/**
 * One figure of the meter form. The texts are already translated.
 * A figure with no `whole` is a plain count: no meter, and `emptyWords` is its line.
 */
export type MeterFigure = {
	/** Stable id, also the React key, for example "seats-filled". */
	id: string;
	label: string;
	value: number;
	/** The line under the value when no share shows: a whole of 0, or no whole. For example "No lesson is open yet". */
	emptyWords: string;
	/** The number format of the value and the whole. A whole number in the page locale when absent. */
	format?: Intl.NumberFormat;
} & (
	| {
			/** The whole of the value: a count of all, or a capacity. 0 draws the empty track and `emptyWords`. */
			whole: number;
			/** The words after the share, for example "of capacity". */
			wholeWords: string;
	  }
	| { whole?: undefined; wholeWords?: undefined }
);

type MeterFiguresProps = {
	/** The figures to show, in order. */
	items: MeterFigure[];
	/** The grid class of the slot, for example the column count. */
	className?: string;
};

/** One Card per item: the label, "value / whole", the meter, and the share line. A whole of 0 shows no "/ 0". */
export function MeterFigures({ items, className }: MeterFiguresProps) {
	const { locale } = useT();
	const share = shareFormat(locale);

	return (
		<div className={cn("grid gap-4", className)}>
			{items.map((item) => {
				const number = item.format ?? new Intl.NumberFormat(locale);
				const whole = item.whole ?? 0;
				return (
					<Card key={item.id} className="py-5">
						<CardContent className="grid content-start gap-2 px-5">
							<p className="label-text text-muted-foreground text-sm">
								{item.label}
							</p>
							<p className="font-bold font-numeric text-3xl tabular-nums leading-none">
								{number.format(item.value)}
								{whole > 0 ? (
									<span className="font-medium text-lg text-muted-foreground">
										{` / ${number.format(whole)}`}
									</span>
								) : null}
							</p>
							{item.whole === undefined ? null : (
								<Progress
									value={item.value}
									max={item.whole}
									aria-label={item.label}
									className="mt-1"
								/>
							)}
							{/* A whole of 0 draws the empty track and no share. One muted line tells why. */}
							<p className="text-muted-foreground text-sm">
								{whole > 0 ? (
									<>
										<bdi
											dir="ltr"
											className="font-medium text-foreground tabular-nums"
										>
											{share.format(
												item.value < whole
													? Math.min(item.value / whole, MAX_SHARE_UNDER_WHOLE)
													: item.value / whole,
											)}
										</bdi>
										{` ${item.wholeWords}`}
									</>
								) : (
									item.emptyWords
								)}
							</p>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

type MeterFiguresSkeletonProps = {
	/** How many figures the slot shows. */
	count: number;
	/** The same grid class as MeterFigures. */
	className?: string;
};

/** Placeholder of the card figures: the label, the value, the meter, and the share line in their final sizes. */
export function MeterFiguresSkeleton({
	count,
	className,
}: MeterFiguresSkeletonProps) {
	return (
		<div className={cn("grid gap-4", className)}>
			{Array.from({ length: count }, (_, index) => `figure-${index}`).map(
				(key) => (
					<Card key={key} className="py-5">
						<CardContent className="grid gap-2 px-5">
							<Skeleton className="h-5 w-28" />
							<Skeleton className="h-8 w-24" />
							<Skeleton className="mt-1 h-2 w-full" />
							<Skeleton className="h-5 w-32" />
						</CardContent>
					</Card>
				),
			)}
		</div>
	);
}
