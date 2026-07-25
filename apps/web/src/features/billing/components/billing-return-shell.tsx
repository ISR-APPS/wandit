import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@wandit/ui/components/card";
import { cn } from "@wandit/ui/lib/utils";
import { Check, Clock3, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";

import { Spark } from "@/components/logo";

export type BillingReturnTone = "error" | "progress" | "success" | "warning";

export function BillingReturnShell({
	tone,
	title,
	body,
	details,
	actions,
}: {
	tone: BillingReturnTone;
	title: string;
	body: string;
	details?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<main className="relative grid min-h-[100dvh] overflow-hidden bg-background px-4 py-10 sm:px-6">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-horizon opacity-80 [-webkit-mask-image:linear-gradient(to_bottom,black,transparent)] [mask-image:linear-gradient(to_bottom,black,transparent)]"
			/>
			<Card
				role={tone === "error" ? "alert" : "status"}
				aria-live="polite"
				className="relative m-auto w-full max-w-[520px] gap-0 overflow-hidden rounded-[22px] py-0 shadow-[0_28px_70px_-42px_color-mix(in_oklab,var(--foreground)_45%,transparent)]"
			>
				<CardHeader className="gap-0 border-b px-5 py-4 sm:px-6">
					<div className="flex items-center gap-2">
						<span className="grid size-8 place-items-center rounded-[10px] border bg-background shadow-xs">
							<Spark className="size-3.5 text-primary" />
						</span>
						<span className="font-display font-semibold text-sm tracking-tight">
							Wandit
						</span>
					</div>
				</CardHeader>

				<CardContent className="px-5 py-8 sm:px-8 sm:py-10">
					<div className="flex flex-col items-start">
						<BillingReturnIcon tone={tone} />
						<h1 className="mt-5 max-w-[420px] font-display font-semibold text-2xl tracking-[-0.6px]">
							{title}
						</h1>
						<p className="mt-2 max-w-[430px] text-muted-foreground text-sm leading-relaxed">
							{body}
						</p>
					</div>

					{details ? (
						<div className="mt-7 rounded-[15px] border bg-secondary/55 p-4">
							{details}
						</div>
					) : null}
				</CardContent>

				{actions ? (
					<CardFooter className="justify-end gap-2 border-t bg-secondary/45 px-5 py-4 sm:px-6">
						{actions}
					</CardFooter>
				) : null}
			</Card>
		</main>
	);
}

export function DashboardButton({
	label,
	variant = "default",
}: {
	label: string;
	variant?: "default" | "outline";
}) {
	return (
		<Button asChild variant={variant} className="active:scale-[0.98]">
			<Link to="/dashboard">{label}</Link>
		</Button>
	);
}

export function ProjectButton({
	label,
	projectId,
	variant = "default",
}: {
	label: string;
	projectId: string;
	variant?: "default" | "outline";
}) {
	return (
		<Button asChild variant={variant} className="active:scale-[0.98]">
			<Link to="/p/$projectId" params={{ projectId }}>
				{label}
			</Link>
		</Button>
	);
}

function BillingReturnIcon({ tone }: { tone: BillingReturnTone }) {
	return (
		<span
			className={cn(
				"grid size-12 place-items-center rounded-[14px] border",
				tone === "progress" && "border-primary/25 bg-primary/8 text-primary",
				tone === "success" && "border-success/30 bg-success/10 text-success",
				tone === "warning" &&
					"border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
				tone === "error" &&
					"border-destructive/30 bg-destructive/10 text-destructive",
			)}
		>
			{tone === "progress" ? (
				<Loader2 className="size-5 animate-spin" aria-hidden />
			) : tone === "success" ? (
				<Check className="size-5" strokeWidth={2.2} aria-hidden />
			) : tone === "warning" ? (
				<Clock3 className="size-5" strokeWidth={1.9} aria-hidden />
			) : (
				<X className="size-5" strokeWidth={2.1} aria-hidden />
			)}
		</span>
	);
}
