// Shared pieces of the publish panel: status indicators, the ember orb,
// progress bar, live-URL row, decorative QR and brand share icons. Same
// visual idioms as the chat mock thread, sized for the panel (dc 4a).

import { cn } from "@wandit/ui/lib/utils";
import { Check, Copy, ExternalLink, Info } from "lucide-react";
import type * as React from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";

/** Success-filled check circle for completed checklist rows. */
export function CheckCircle({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"grid size-4 shrink-0 place-items-center rounded-full bg-success",
				className,
			)}
		>
			<Check className="size-[62%] text-background" strokeWidth={2.75} />
		</span>
	);
}

/** Stone ring for pending checklist rows. */
export function PendingRing({ className }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				"size-4 shrink-0 rounded-full border-2 border-stone",
				className,
			)}
		/>
	);
}

/** Spinning arc for the active checklist row — ember on parchment, white on
    the ember orb. */
export function SpinnerArc({
	className,
	onEmber = false,
}: {
	className?: string;
	onEmber?: boolean;
}) {
	return (
		<svg
			className={cn("size-4 shrink-0 animate-spin", className)}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden
			role="presentation"
		>
			<circle
				cx="12"
				cy="12"
				r="9"
				stroke={
					onEmber
						? "color-mix(in oklab, white 35%, transparent)"
						: "var(--stone)"
				}
				strokeWidth="2.5"
			/>
			<path
				d="M12 3a9 9 0 0 1 9 9"
				stroke={onEmber ? "white" : "var(--primary)"}
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** Ember-gradient orb with a soft glow — hero of the progress/done screens. */
export function EmberOrb({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<span
			className={cn(
				"grid size-16 shrink-0 place-items-center rounded-full bg-gradient-ember shadow-[0_12px_30px_-10px_color-mix(in_oklab,var(--ember-2)_55%,transparent)]",
				className,
			)}
		>
			{children}
		</span>
	);
}

/** Indeterminate-feel progress bar: ember gradient fill pulsing on a linen track. */
export function PulseBar({ value }: { value: number }) {
	return (
		<div className="h-[5px] overflow-hidden rounded-full bg-border">
			<div
				className="h-full animate-pulse rounded-full bg-gradient-ember transition-[width] duration-700"
				style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
			/>
		</div>
	);
}

/** One row of a deploy/provisioning checklist. */
export function ChecklistRow({
	state,
	children,
}: {
	state: "done" | "active" | "pending";
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-[11px] text-sm",
				state === "done" && "text-ink-soft",
				state === "active" && "font-medium text-foreground",
				state === "pending" && "text-faint",
			)}
		>
			{state === "done" ? (
				<CheckCircle className="size-[18px]" />
			) : state === "active" ? (
				<SpinnerArc className="size-[18px]" />
			) : (
				<PendingRing className="size-[18px]" />
			)}
			{children}
		</div>
	);
}

/** Ember info circle + low-emphasis explainer line. */
export function InfoNote({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex items-start gap-[9px] text-[12.5px] text-muted-foreground leading-normal",
				className,
			)}
		>
			<Info
				className="mt-px size-[15px] shrink-0 text-primary"
				strokeWidth={1.7}
			/>
			<span>{children}</span>
		</div>
	);
}

/** 30px circular hairline icon button (panel header close, URL row actions). */
export const roundIconClass =
	"grid size-[30px] shrink-0 place-items-center rounded-full border border-border bg-background text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50";

export function RoundIconButton({
	className,
	...props
}: React.ComponentProps<"button">) {
	return (
		<button
			type="button"
			className={cn(roundIconClass, className)}
			{...props}
		/>
	);
}

/** Live link row: pulsing green dot, truncated URL, copy + open actions. */
export function LiveUrlRow({ url, href }: { url: string; href: string }) {
	const { t } = useTranslation();
	const copy = () => {
		void navigator.clipboard.writeText(href);
		toast.success(t("workspace.publish.linkCopied"));
	};
	return (
		<div className="flex items-center gap-[9px] rounded-[13px] border border-border bg-secondary py-2 ps-3 pe-2">
			<span
				aria-hidden
				className="size-2 shrink-0 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_18%,transparent)]"
			/>
			<span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
				{url}
			</span>
			<RoundIconButton
				aria-label={t("workspace.publish.copyLink")}
				onClick={copy}
			>
				<Copy className="size-3.5" strokeWidth={1.8} />
			</RoundIconButton>
			<a
				href={href}
				target="_blank"
				rel="noreferrer"
				aria-label={t("workspace.publish.openLive")}
				className={roundIconClass}
			>
				<ExternalLink className="size-3.5" strokeWidth={1.8} />
			</a>
		</div>
	);
}

// Decorative QR pattern from the dc reference — mock content, not a real code.
const QR_MODULES =
	"M8 2h1v1h-1zM10 3h1v1h-1zM12 2h1v1h-1zM14 4h1v1h-1zM16 3h1v1h-1zM9 5h1v1h-1zM11 6h1v1h-1zM13 5h1v1h-1zM15 6h1v1h-1zM17 4h1v1h-1zM2 8h1v1h-1zM4 9h1v1h-1zM6 8h1v1h-1zM3 10h1v1h-1zM5 11h1v1h-1zM1 12h1v1h-1zM8 8h1v1h-1zM9 9h1v1h-1zM11 8h1v1h-1zM13 9h1v1h-1zM15 8h1v1h-1zM17 10h1v1h-1zM19 8h1v1h-1zM21 9h1v1h-1zM23 8h1v1h-1zM8 11h1v1h-1zM10 12h1v1h-1zM12 11h1v1h-1zM14 13h1v1h-1zM16 12h1v1h-1zM18 11h1v1h-1zM20 13h1v1h-1zM22 12h1v1h-1zM24 14h1v1h-1zM9 14h1v1h-1zM11 15h1v1h-1zM13 14h1v1h-1zM15 16h1v1h-1zM17 15h1v1h-1zM19 14h1v1h-1zM21 16h1v1h-1zM23 15h1v1h-1zM8 17h1v1h-1zM10 18h1v1h-1zM12 17h1v1h-1zM14 19h1v1h-1zM16 18h1v1h-1zM18 17h1v1h-1zM20 19h1v1h-1zM22 18h1v1h-1zM9 20h1v1h-1zM11 21h1v1h-1zM13 20h1v1h-1zM15 22h1v1h-1zM17 21h1v1h-1zM19 20h1v1h-1zM21 22h1v1h-1zM23 21h1v1h-1zM8 23h1v1h-1zM10 24h1v1h-1zM12 23h1v1h-1zM14 24h1v1h-1zM16 23h1v1h-1zM18 24h1v1h-1zM20 23h1v1h-1zM22 24h1v1h-1zM1 15h1v1h-1zM3 16h1v1h-1zM5 15h1v1h-1zM2 18h1v1h-1zM4 20h1v1h-1z";

function QrFinder({ x, y }: { x: number; y: number }) {
	return (
		<g>
			<rect x={x} y={y} width="7" height="7" className="fill-void" />
			<rect
				x={x + 1}
				y={y + 1}
				width="5"
				height="5"
				className="fill-background"
			/>
			<rect x={x + 2} y={y + 2} width="3" height="3" className="fill-void" />
		</g>
	);
}

/** Fake QR code — visual placeholder until published pages get a real one. */
export function MockQr({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 25 25"
			shapeRendering="crispEdges"
			className={cn("block", className)}
			aria-hidden
			role="presentation"
		>
			<rect width="25" height="25" className="fill-background" />
			<path d={QR_MODULES} className="fill-void" />
			<QrFinder x={0} y={0} />
			<QrFinder x={18} y={0} />
			<QrFinder x={0} y={18} />
		</svg>
	);
}

// Brand share glyphs (lucide dropped brand icons) — paths from the dc reference.

export function WhatsAppIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			className={className}
			aria-hidden
			role="presentation"
		>
			<path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.6-6c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5 0-.7.3-.3.3-.9.9-.9 2.1 0 1.2.9 2.4 1 2.6.1.2 1.7 2.7 4.2 3.7 1.6.7 2.2.7 3 .6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3Z" />
		</svg>
	);
}

export function FacebookIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			className={className}
			aria-hidden
			role="presentation"
		>
			<path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8V12h2.4V9.9c0-2.4 1.4-3.7 3.6-3.7l2 .2v2.2h-1c-1.1 0-1.5.7-1.5 1.4V12h2.5l-.4 2.9h-2.1v7A10 10 0 0 0 22 12Z" />
		</svg>
	);
}

export function InstagramIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			className={className}
			aria-hidden
			role="presentation"
		>
			<rect x="3" y="3" width="18" height="18" rx="5.5" />
			<circle cx="12" cy="12" r="4" />
			<circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
		</svg>
	);
}
