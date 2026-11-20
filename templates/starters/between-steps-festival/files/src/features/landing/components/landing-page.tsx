// This page presents the festival program and venue access information.
// The home route renders it. The tabs group performances and workshops.

import { ArrowDownIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";

/** Lets visitors browse events by type and find access details before they travel. */
export function LandingPage() {
	const { t } = useT();
	const events = [
		{
			name: t("landing.fold"),
			when: t("landing.foldTime"),
			where: t("landing.mainStage"),
			type: "shows",
			description: t("landing.foldBody"),
		},
		{
			name: t("landing.weight"),
			when: t("landing.weightTime"),
			where: t("landing.workshop"),
			type: "workshops",
			description: t("landing.weightBody"),
		},
		{
			name: t("landing.water"),
			when: t("landing.waterTime"),
			where: t("landing.mainStage"),
			type: "shows",
			description: t("landing.waterBody"),
		},
	];
	const views = [
		{ id: "all", label: t("landing.all") },
		{ id: "shows", label: t("landing.shows") },
		{ id: "workshops", label: t("landing.workshops") },
	];

	return (
		<div className="mx-auto max-w-[100rem] px-4 pb-4 sm:px-8 sm:pb-8">
			<header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-primary border-b py-4 sm:py-5">
				<a className="font-display font-extrabold text-xl" href="#top">
					{t("common.appName")}
				</a>
				<nav
					className="flex flex-wrap gap-5 font-semibold text-sm"
					aria-label="Festival"
				>
					<a className="hover:underline" href="#program">
						{t("landing.program")}
					</a>
					<a className="hover:underline" href="#access">
						{t("landing.access")}
					</a>
				</nav>
			</header>
			<main id="top">
				<section className="grid overflow-hidden border-primary border-b lg:grid-cols-[1.05fr_1fr]">
					<div className="@container flex min-w-0 flex-col justify-between gap-8 bg-primary py-8 pr-5 pl-4 text-primary-foreground sm:pl-8 lg:py-14">
						<p className="font-bold text-sm">{t("landing.discipline")}</p>
						<h1 className="font-extrabold text-[clamp(1.65rem,10.7cqi,7.8rem)] uppercase leading-[0.78] tracking-[-0.095em]">
							<span className="block">{t("landing.first")}</span>
							<span className="block">{t("landing.last")}</span>
						</h1>
						<div className="flex flex-wrap items-end justify-between gap-5">
							<p className="max-w-56 font-semibold text-sm">
								{t("landing.heroSubtitle")}
							</p>
							<a
								className="inline-flex items-center gap-2 border-current border-b pb-1 font-bold text-sm"
								href="#program"
							>
								{t("landing.see")}
								<ArrowDownIcon aria-hidden="true" />
							</a>
						</div>
					</div>
					<img
						src="/images/studio.webp"
						width={1440}
						height={960}
						alt={t("landing.heroAlt")}
						className="h-full min-h-56 w-full object-cover"
					/>
				</section>
				<section id="program" className="py-12 sm:py-20">
					<h2 className="mb-6 font-extrabold text-4xl sm:text-6xl">
						{t("landing.program")}
					</h2>
					<Tabs defaultValue="all" className="gap-6">
						<TabsList
							className="h-auto w-full flex-wrap justify-start gap-1"
							aria-label="Event types"
						>
							{views.map((view) => (
								<TabsTrigger
									value={view.id}
									key={view.id}
									className="px-3 py-2"
								>
									{view.label}
								</TabsTrigger>
							))}
						</TabsList>
						{views.map((view) => (
							<TabsContent key={view.id} value={view.id}>
								<ul className="divide-y divide-foreground/35 border-foreground/35 border-y">
									{events
										.filter(
											(event) => view.id === "all" || event.type === view.id,
										)
										.map((event) => (
											<li
												key={event.name}
												className="grid gap-2 px-1 py-5 sm:grid-cols-[0.7fr_1fr_1fr]"
											>
												<span className="font-bold text-primary text-sm">
													{event.when}
													<span className="mt-1 block font-normal text-foreground">
														{event.where}
													</span>
												</span>
												<h3 className="font-bold text-2xl">{event.name}</h3>
												<p className="max-w-sm text-sm leading-relaxed">
													{event.description}
												</p>
											</li>
										))}
								</ul>
							</TabsContent>
						))}
					</Tabs>
				</section>
				<section
					id="access"
					className="grid gap-5 border-primary border-t py-9 sm:grid-cols-2"
				>
					<h2 className="font-bold text-3xl">{t("landing.access")}</h2>
					<div>
						<p className="max-w-md leading-relaxed">
							{t("landing.accessBody")}
						</p>
						<a
							className="mt-4 inline-block border-primary border-b pb-1 text-primary"
							href="mailto:access@betweensteps.example"
						>
							{t("landing.email")}
						</a>
					</div>
				</section>
			</main>
		</div>
	);
}
