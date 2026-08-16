import { FunnelSimpleIcon } from "@phosphor-icons/react/FunnelSimple";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AnalyticsQuery } from "@/features/analytics/api/analytics.dto";

const sourceBuckets = [
	{ value: "affiliate", label: "Affiliate" },
	{ value: "organic_search", label: "Organic search" },
	{ value: "referral", label: "Referral" },
	{ value: "direct", label: "Direct" },
	{ value: "unknown", label: "Unknown" },
] as const;

const devices = [
	{ value: "desktop", label: "Desktop" },
	{ value: "mobile", label: "Mobile" },
	{ value: "tablet", label: "Tablet" },
] as const;

type SourceBucket = (typeof sourceBuckets)[number]["value"];
type SourceMode = SourceBucket | "all" | "custom";
type DeviceMode = Exclude<AnalyticsQuery["device"], undefined> | "all";

type FilterDraft = {
	sourceMode: SourceMode;
	customSource: string;
	country: string;
	device: DeviceMode;
	cohortOnly: boolean;
};

type AnalyticsFilterControlProps = {
	value: AnalyticsQuery;
	includeCohortOnly?: boolean;
	onChange: (query: AnalyticsQuery) => void;
};

function isSourceBucket(value: string | undefined): value is SourceBucket {
	return sourceBuckets.some((source) => source.value === value);
}

function createFilterDraft(value: AnalyticsQuery): FilterDraft {
	const sourceMode = !value.source
		? "all"
		: isSourceBucket(value.source)
			? value.source
			: "custom";

	return {
		sourceMode,
		customSource: sourceMode === "custom" ? (value.source ?? "") : "",
		country: value.country ?? "",
		device: value.device ?? "all",
		cohortOnly: value.cohortOnly,
	};
}

function countActiveFilters(
	value: AnalyticsQuery,
	includeCohortOnly: boolean,
): number {
	return (
		Number(Boolean(value.source)) +
		Number(Boolean(value.country)) +
		Number(Boolean(value.device)) +
		Number(includeCohortOnly && value.cohortOnly)
	);
}

function AnalyticsFilterControl({
	value,
	includeCohortOnly = false,
	onChange,
}: AnalyticsFilterControlProps) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<FilterDraft>(() =>
		createFilterDraft(value),
	);
	const activeCount = countActiveFilters(value, includeCohortOnly);
	const normalizedCustomSource = draft.customSource.trim();
	const normalizedCountry = draft.country.trim().toUpperCase();
	const hasValidSource =
		draft.sourceMode !== "custom" || normalizedCustomSource.length > 0;
	const hasValidCountry =
		normalizedCountry.length === 0 || /^[A-Z]{2}$/.test(normalizedCountry);
	const canApply = hasValidSource && hasValidCountry;

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setDraft(createFilterDraft(value));
		}

		setOpen(nextOpen);
	}

	function handleApply() {
		if (!canApply) return;

		const {
			source: _source,
			country: _country,
			device: _device,
			...baseQuery
		} = value;
		const source =
			draft.sourceMode === "all"
				? undefined
				: draft.sourceMode === "custom"
					? normalizedCustomSource
					: draft.sourceMode;
		const device = draft.device === "all" ? undefined : draft.device;

		onChange({
			...baseQuery,
			...(source ? { source } : {}),
			...(normalizedCountry ? { country: normalizedCountry } : {}),
			...(device ? { device } : {}),
			cohortOnly: includeCohortOnly ? draft.cohortOnly : false,
		});
		setOpen(false);
	}

	function handleClearAll() {
		const {
			source: _source,
			country: _country,
			device: _device,
			...baseQuery
		} = value;

		onChange({ ...baseQuery, cohortOnly: false });
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className="bg-background font-normal"
					aria-label={`Analytics filters${activeCount > 0 ? `, ${activeCount} active` : ""}`}
				>
					<FunnelSimpleIcon aria-hidden="true" />
					Filters
					{activeCount > 0 ? (
						<Badge variant="secondary" className="min-w-5 px-1.5 tabular-nums">
							{activeCount}
						</Badge>
					) : null}
				</Button>
			</PopoverTrigger>

			<PopoverContent
				align="end"
				aria-label="Analytics filters"
				className="w-[min(22rem,calc(100vw-2rem))] p-0"
			>
				<PopoverHeader className="border-b px-4 py-3">
					<PopoverTitle>Filter analytics</PopoverTitle>
					<PopoverDescription>
						Restrict the report to attributed users matching every filter.
					</PopoverDescription>
				</PopoverHeader>

				<div className="grid gap-4 px-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="analytics-source-filter">Source</Label>
						<Select
							value={draft.sourceMode}
							onValueChange={(sourceMode) => {
								if (
									sourceMode !== "all" &&
									sourceMode !== "custom" &&
									!isSourceBucket(sourceMode)
								) {
									return;
								}

								setDraft((current) => ({ ...current, sourceMode }));
							}}
						>
							<SelectTrigger id="analytics-source-filter" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All sources</SelectItem>
								{sourceBuckets.map((source) => (
									<SelectItem key={source.value} value={source.value}>
										{source.label}
									</SelectItem>
								))}
								<SelectItem value="custom">Custom UTM source</SelectItem>
							</SelectContent>
						</Select>
						{draft.sourceMode === "custom" ? (
							<div className="grid gap-1.5">
								<Label htmlFor="analytics-utm-source" className="sr-only">
									UTM source
								</Label>
								<Input
									id="analytics-utm-source"
									value={draft.customSource}
									maxLength={200}
									placeholder="UTM source, for example newsletter"
									aria-invalid={!hasValidSource}
									onChange={(event) => {
										setDraft((current) => ({
											...current,
											customSource: event.target.value,
										}));
									}}
								/>
								<p className="text-muted-foreground text-xs">
									{hasValidSource
										? "Matches the trimmed UTM source, ignoring case."
										: "Enter a UTM source before applying."}
								</p>
							</div>
						) : null}
					</div>

					<div className="grid gap-2 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="analytics-country-filter">Country</Label>
							<Input
								id="analytics-country-filter"
								value={draft.country}
								maxLength={2}
								placeholder="Any"
								autoCapitalize="characters"
								aria-invalid={!hasValidCountry}
								onChange={(event) => {
									const country = event.target.value
										.toUpperCase()
										.replace(/[^A-Z]/g, "")
										.slice(0, 2);
									setDraft((current) => ({ ...current, country }));
								}}
							/>
							<p className="text-muted-foreground text-xs">
								{hasValidCountry
									? "2-letter code"
									: "Enter a 2-letter country code."}
							</p>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="analytics-device-filter">Device</Label>
							<Select
								value={draft.device}
								onValueChange={(device) => {
									if (
										device !== "all" &&
										!devices.some((item) => item.value === device)
									) {
										return;
									}

									setDraft((current) => ({
										...current,
										device: device as DeviceMode,
									}));
								}}
							>
								<SelectTrigger id="analytics-device-filter" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">Any device</SelectItem>
									{devices.map((device) => (
										<SelectItem key={device.value} value={device.value}>
											{device.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{includeCohortOnly ? (
						<div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 px-3 py-2.5">
							<div className="min-w-0">
								<Label htmlFor="analytics-cohort-filter">
									Signed up in range
								</Label>
								<p className="mt-1 text-muted-foreground text-xs">
									Only include activity from the selected signup cohort.
								</p>
							</div>
							<Switch
								id="analytics-cohort-filter"
								checked={draft.cohortOnly}
								onCheckedChange={(cohortOnly) => {
									setDraft((current) => ({ ...current, cohortOnly }));
								}}
							/>
						</div>
					) : null}

					<p className="border-t pt-3 text-muted-foreground text-xs leading-relaxed">
						Device is known only for users attributed after Phase 2.5 shipped.
					</p>
				</div>

				<div className="flex items-center justify-between gap-2 border-t px-4 py-3">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={activeCount === 0}
						onClick={handleClearAll}
					>
						Clear all
					</Button>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							size="sm"
							disabled={!canApply}
							onClick={handleApply}
						>
							Apply
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export type { AnalyticsFilterControlProps };
export { AnalyticsFilterControl };
