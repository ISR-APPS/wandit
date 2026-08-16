import { PlusCircleIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import type { UserCreditsUsedRange } from "@/features/users/api/users.dto";
import { USER_CREDITS_USED_SLIDER_MAX } from "@/features/users/lib/constants";

type UsersCreditsUsedFilterProps = {
	value?: UserCreditsUsedRange;
	onValueChange: (range: UserCreditsUsedRange | undefined) => void;
};

/** Compact "100–500" / "100+" / "≤ 500" pill label for the active range. */
function formatCreditsUsedRange({ min, max }: UserCreditsUsedRange): string {
	if (min !== undefined && max !== undefined) {
		return min === max ? `${min}` : `${min}–${max}`;
	}

	if (min !== undefined) {
		return `${min}+`;
	}

	return `≤ ${max}`;
}

/** "" means unbounded; anything else must parse to a nonnegative integer. */
function parseBound(raw: string): number | undefined {
	if (raw.trim() === "") {
		return undefined;
	}

	const value = Number(raw);

	return Number.isInteger(value) && value >= 0 ? value : Number.NaN;
}

/**
 * Credits-used range filter pill. The dual-thumb slider covers 0 to
 * USER_CREDITS_USED_SLIDER_MAX with the max thumb parked at the right edge
 * meaning "no upper bound"; the numeric inputs accept values beyond the
 * slider ceiling. Nothing commits until Apply.
 */
function UsersCreditsUsedFilter({
	value,
	onValueChange,
}: UsersCreditsUsedFilterProps) {
	const [open, setOpen] = useState(false);
	// Drafts are strings so the inputs can be cleared; "" = unbounded.
	const [draftMin, setDraftMin] = useState("");
	const [draftMax, setDraftMax] = useState("");

	const parsedMin = parseBound(draftMin);
	const parsedMax = parseBound(draftMax);
	const isInvalid =
		Number.isNaN(parsedMin) ||
		Number.isNaN(parsedMax) ||
		(parsedMin !== undefined &&
			parsedMax !== undefined &&
			parsedMin > parsedMax);

	// Thumb positions derived from the drafts, clamped to the slider scale.
	const minThumb = Math.min(
		Number.isNaN(parsedMin) ? 0 : (parsedMin ?? 0),
		USER_CREDITS_USED_SLIDER_MAX,
	);
	const maxThumb =
		parsedMax === undefined || Number.isNaN(parsedMax)
			? USER_CREDITS_USED_SLIDER_MAX
			: Math.min(parsedMax, USER_CREDITS_USED_SLIDER_MAX);

	const openPopover = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraftMin(value?.min !== undefined ? String(value.min) : "");
			setDraftMax(value?.max !== undefined ? String(value.max) : "");
		}

		setOpen(nextOpen);
	};

	const handleSliderChange = ([nextMin, nextMax]: number[]) => {
		// Only write back the thumb that moved, so a typed bound beyond the
		// slider ceiling survives dragging the other thumb.
		if (nextMin !== undefined && nextMin !== minThumb) {
			setDraftMin(nextMin === 0 ? "" : String(nextMin));
		}

		if (nextMax !== undefined && nextMax !== maxThumb) {
			setDraftMax(
				nextMax === USER_CREDITS_USED_SLIDER_MAX ? "" : String(nextMax),
			);
		}
	};

	const clearFilter = () => {
		setDraftMin("");
		setDraftMax("");
		onValueChange(undefined);
		setOpen(false);
	};

	const applyFilter = () => {
		if (isInvalid) {
			return;
		}

		onValueChange(
			parsedMin === undefined && parsedMax === undefined
				? undefined
				: { min: parsedMin, max: parsedMax },
		);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={openPopover}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 border-dashed"
					aria-label="Filter by credits used"
				>
					<PlusCircleIcon data-icon="inline-start" />
					Credits used
					{value ? (
						<>
							<Separator orientation="vertical" className="mx-2 h-4" />
							<Badge
								variant="secondary"
								className="rounded-sm px-1 font-normal"
							>
								{formatCreditsUsedRange(value)}
							</Badge>
						</>
					) : null}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[260px] space-y-4" align="start">
				<Slider
					value={[minThumb, maxThumb]}
					min={0}
					max={USER_CREDITS_USED_SLIDER_MAX}
					step={10}
					minStepsBetweenThumbs={0}
					onValueChange={handleSliderChange}
					aria-label="Credits used range"
				/>
				<div className="flex items-end gap-2">
					<div className="grid flex-1 gap-1.5">
						<Label
							htmlFor="credits-used-min"
							className="text-muted-foreground text-xs"
						>
							Min
						</Label>
						<Input
							id="credits-used-min"
							type="number"
							inputMode="numeric"
							min={0}
							placeholder="0"
							value={draftMin}
							onChange={(event) => setDraftMin(event.target.value)}
							className="h-8"
						/>
					</div>
					<div className="grid flex-1 gap-1.5">
						<Label
							htmlFor="credits-used-max"
							className="text-muted-foreground text-xs"
						>
							Max
						</Label>
						<Input
							id="credits-used-max"
							type="number"
							inputMode="numeric"
							min={0}
							placeholder="No max"
							value={draftMax}
							onChange={(event) => setDraftMax(event.target.value)}
							className="h-8"
						/>
					</div>
				</div>
				<div className="flex justify-between gap-2">
					<Button type="button" variant="ghost" size="sm" onClick={clearFilter}>
						Clear
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={isInvalid}
						onClick={applyFilter}
					>
						Apply
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export type { UsersCreditsUsedFilterProps };
export { UsersCreditsUsedFilter };
