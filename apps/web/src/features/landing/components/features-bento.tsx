import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { cn } from "@wandit/ui/lib/utils";
import {
	ChevronRight,
	Coins,
	History,
	Inbox,
	Languages,
	Phone,
	Rocket,
	Smartphone,
} from "lucide-react";
import type * as React from "react";

import { FEATURES_CONFIG } from "../lib/constants";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

function BentoCell({
	icon: Icon,
	title,
	body,
	className,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	body: string;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card/50 p-5 transition-colors duration-200 hover:border-primary/30 md:p-6",
				className,
			)}
		>
			<span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
				<Icon className="size-4" />
			</span>
			<h3 className="font-display font-semibold text-lg tracking-[-0.01em]">
				{title}
			</h3>
			<p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
			{children}
		</div>
	);
}

function FauxLeadRow({ name, phone }: { name: string; phone: string }) {
	return (
		<div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
			<span className="size-5 shrink-0 rounded-full bg-foreground/10" />
			<span className={cn("h-1.5 rounded-full bg-foreground/20", name)} />
			<span
				className={cn("ms-auto h-1.5 rounded-full bg-foreground/10", phone)}
			/>
			<Phone className="size-3 shrink-0 text-success" />
		</div>
	);
}

function DirectionPanel({ rtl }: { rtl?: boolean }) {
	const { directionPanel } = useDictionary().landing.features;
	return (
		<div
			dir={rtl ? "rtl" : undefined}
			className="rounded-lg border border-border/70 bg-background/60 p-3"
		>
			<div className="mb-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
				<span>{rtl ? directionPanel.rtlLang : directionPanel.ltrLang}</span>
				<span>{rtl ? "RTL" : "LTR"}</span>
			</div>
			<div className="flex flex-col items-start gap-1.5">
				<span className="h-1.5 w-4/5 rounded-full bg-foreground/25" />
				<span className="h-1.5 w-3/5 rounded-full bg-foreground/15" />
				<span className="h-1.5 w-2/3 rounded-full bg-foreground/10" />
				<span className="mt-1 h-3.5 w-2/5 rounded bg-primary/60" />
			</div>
		</div>
	);
}

export function FeaturesBento() {
	const { t } = useTranslation();
	const { items, pipeline } = useDictionary().landing.features;
	const { publishUrl } = FEATURES_CONFIG;

	return (
		<section className="px-4 py-16 md:py-24">
			<div className="mx-auto max-w-6xl">
				<SectionHeader
					kicker={t("landing.features.kicker")}
					title={t("landing.features.title")}
				/>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
					<Reveal className="sm:col-span-2 lg:col-span-7">
						<BentoCell
							icon={Languages}
							title={items.rtl.title}
							body={items.rtl.body}
						>
							<div className="mt-auto grid grid-cols-2 gap-3 pt-2">
								<DirectionPanel />
								<DirectionPanel rtl />
							</div>
						</BentoCell>
					</Reveal>

					<Reveal delay={0.07} className="lg:col-span-5">
						<BentoCell
							icon={Inbox}
							title={items.leads.title}
							body={items.leads.body}
						>
							<div className="mt-auto flex flex-col gap-3 pt-2">
								<div className="flex flex-col gap-1.5">
									<FauxLeadRow name="w-24" phone="w-20" />
									<FauxLeadRow name="w-16" phone="w-24" />
								</div>
								<div className="flex flex-wrap items-center gap-1.5 font-medium font-mono text-[10px]">
									<span className="rounded-full bg-ember-1/15 px-2 py-1 text-ember-2 dark:text-ember-1">
										{pipeline[0]}
									</span>
									<ChevronRight className="size-3 text-muted-foreground/60 rtl:rotate-180" />
									<span className="rounded-full bg-primary/15 px-2 py-1 text-primary">
										{pipeline[1]}
									</span>
									<ChevronRight className="size-3 text-muted-foreground/60 rtl:rotate-180" />
									<span className="rounded-full bg-success/15 px-2 py-1 text-success">
										{pipeline[2]}
									</span>
								</div>
							</div>
						</BentoCell>
					</Reveal>

					<Reveal className="lg:col-span-3">
						<BentoCell
							icon={Rocket}
							title={items.publish.title}
							body={items.publish.body}
						>
							<div className="mt-auto flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 font-mono text-xs">
								<span className="relative flex size-1.5 shrink-0">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
									<span className="relative inline-flex size-1.5 rounded-full bg-success" />
								</span>
								<span className="truncate">
									{publishUrl.slug}
									<span className="text-muted-foreground">
										{publishUrl.domain}
									</span>
								</span>
							</div>
						</BentoCell>
					</Reveal>

					<Reveal delay={0.07} className="lg:col-span-3">
						<BentoCell
							icon={Coins}
							title={items.credits.title}
							body={items.credits.body}
						/>
					</Reveal>

					<Reveal delay={0.14} className="lg:col-span-3">
						<BentoCell
							icon={Smartphone}
							title={items.mobile.title}
							body={items.mobile.body}
						>
							<div className="mt-auto flex items-end gap-2">
								<div className="flex h-16 w-10 flex-col gap-1 rounded-lg border border-border/70 bg-background/60 p-1.5">
									<span className="h-4 rounded-[3px] bg-gradient-ember opacity-80" />
									<span className="h-1 w-4/5 rounded-full bg-foreground/20" />
									<span className="h-1 w-3/5 rounded-full bg-foreground/10" />
									<span className="mt-auto h-2.5 rounded-[3px] bg-primary/60" />
								</div>
								<span className="mb-1 font-mono text-[10px] text-muted-foreground">
									390px
								</span>
							</div>
						</BentoCell>
					</Reveal>

					<Reveal delay={0.21} className="sm:col-span-2 lg:col-span-3">
						<BentoCell
							icon={History}
							title={items.versions.title}
							body={items.versions.body}
						>
							<div className="mt-auto flex flex-col gap-1.5 pt-1 font-mono text-[10px]">
								<span className="flex items-center gap-2 text-primary">
									v3
									<span className="h-1 flex-1 rounded-full bg-primary/30" />
								</span>
								<span className="flex items-center gap-2 text-muted-foreground">
									v2
									<span className="h-1 flex-1 rounded-full bg-foreground/10" />
								</span>
								<span className="flex items-center gap-2 text-muted-foreground">
									v1
									<span className="h-1 flex-1 rounded-full bg-foreground/10" />
								</span>
							</div>
						</BentoCell>
					</Reveal>
				</div>
			</div>
		</section>
	);
}
