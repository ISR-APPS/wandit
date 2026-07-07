// DEMO-ONLY mock thread showcasing the full vocabulary of chat states in the
// warm-parchment design language (DESIGN.md) — plain replies, clarifying
// chips, build progress, version cards, option pickers, media results,
// errors and publish success. Rendered by ChatPane instead of the live
// backend thread while MOCK_CHAT_THREAD_ENABLED is true; flip it to false
// (or delete this file and its two references) to restore live chat.
// Copy is intentionally hardcoded English — this is a styling showcase, not
// a product surface, so it stays out of the i18n dictionaries.

import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Check, Code, Copy, Lock, Play } from "lucide-react";
import type { ReactNode } from "react";

import { WanditMessageHeader } from "./real-message";

/** Flip to false to hand the chat pane back to the live SSE backend. */
export const MOCK_CHAT_THREAD_ENABLED = true;

/* ---------- tiny building blocks ---------- */

/** Muted mono micro-label naming the state — review aid, styled per the
    "mono micro-label" type role (uppercase, positive tracking). */
function StateLabel({ children }: { children: string }) {
	return (
		<div className="mb-2 font-mono text-[10px] text-faint uppercase tracking-[0.12em]">
			{children}
		</div>
	);
}

function UserBubble({ children }: { children: string }) {
	return (
		<div className="flex justify-end">
			<div className="max-w-[86%] rounded-[18px] rounded-ee-[6px] border border-border bg-bubble px-3.5 py-2.5 text-[14.5px] text-foreground leading-[1.45]">
				{children}
			</div>
		</div>
	);
}

/** Ember-filled check circle for completed checklist rows. */
function DoneCircle() {
	return (
		<span className="grid size-[15px] shrink-0 place-items-center rounded-full bg-primary">
			<Check className="size-2.5 text-background" strokeWidth={3} />
		</span>
	);
}

/** Spinning ember arc for the active checklist row. */
function ActiveArc() {
	return (
		<svg
			className="size-[15px] shrink-0 animate-spin"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden
			role="presentation"
		>
			<circle cx="12" cy="12" r="9" stroke="var(--stone)" strokeWidth="2.5" />
			<path
				d="M12 3a9 9 0 0 1 9 9"
				stroke="var(--primary)"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** Stone ring for pending checklist rows. */
function PendingRing() {
	return (
		<span
			aria-hidden
			className="size-[15px] shrink-0 rounded-full border-2 border-stone"
		/>
	);
}

function BlinkingCaret() {
	return (
		<span
			aria-hidden
			className="ms-1 inline-block h-3 w-[2px] translate-y-0.5 animate-caret bg-foreground align-middle"
		/>
	);
}

/** Success-tinted check circle for finished multi-action rows (the build
    panel uses the ember DoneCircle; tool runs read as green). */
function SuccessCircle() {
	return (
		<span className="grid size-[15px] shrink-0 place-items-center rounded-full bg-success/16">
			<Check className="size-2.5 text-success" strokeWidth={2.5} />
		</span>
	);
}

/** Assistant header whose avatar carries a status tint instead of the ember
    gradient, followed by a mono kicker line — the error/published openers. */
function StatusMessageHeader({
	avatarClass,
	kickerClass,
	kicker,
	children,
}: {
	avatarClass: string;
	kickerClass: string;
	kicker: string;
	children: ReactNode;
}) {
	return (
		<>
			<div className="mb-2 flex items-center gap-2">
				<span
					className={cn(
						"grid size-[22px] shrink-0 place-items-center rounded-full border",
						avatarClass,
					)}
				>
					{children}
				</span>
				<span className="font-medium text-foreground text-sm">Wandit</span>
			</div>
			<div
				className={cn(
					"mb-2 font-mono text-[11px] uppercase tracking-[0.1em]",
					kickerClass,
				)}
			>
				{kicker}
			</div>
		</>
	);
}

/** Fake sneaker hero used by the mock image result — decorative artwork,
    colors are the artwork's own, not chrome tokens. */
function SneakerArt() {
	return (
		<svg
			width="150"
			height="75"
			viewBox="0 0 120 60"
			fill="none"
			aria-hidden
			role="presentation"
			className="drop-shadow-[0_8px_14px_rgba(0,0,0,0.4)]"
		>
			<path
				d="M8 44c0-4 3-7 8-8 8-2 14-6 22-13 4-3 9-4 13-2l30 12c8 3 22 4 30 8 4 2 5 6 3 9-1 2-4 3-8 3H14c-4 0-6-3-6-6v-3Z"
				fill="oklch(0.96 0.02 80)"
			/>
			<path
				d="M8 47h96"
				stroke="oklch(0.7 0.19 38)"
				strokeWidth="3"
				strokeLinecap="round"
			/>
			<path
				d="M40 26c6 4 14 6 22 6"
				stroke="oklch(0.75 0.12 45)"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/* ---------- the thread ---------- */

export function MockChatThread({
	onSend,
}: {
	onSend?: (text: string) => void;
}) {
	return (
		<div className="flex flex-col gap-5">
			{/* 01 — user request */}
			<div>
				<StateLabel>01 · User message</StateLabel>
				<UserBubble>
					Make a drop page for a limited sneaker release in Algiers — hype, a
					countdown, and cash on delivery.
				</UserBubble>
			</div>

			{/* 02 — plain assistant reply */}
			<div>
				<StateLabel>02 · Plain reply</StateLabel>
				<WanditMessageHeader meta="now" />
				<p className="text-[14.5px] text-foreground leading-[1.55]">
					Hype drops convert hard on paid traffic. I'll build a mobile-first
					page: a bold countdown hero, a size picker wired into the order form,
					live stock scarcity, and a frictionless cash-on-delivery checkout for
					all 58 wilayas.
				</p>
			</div>

			{/* 03 — clarifying question + chips + segmented toggle */}
			<div>
				<StateLabel>03 · Clarifying question</StateLabel>
				<WanditMessageHeader />
				<p className="mb-[11px] text-[14.5px] text-foreground leading-[1.5]">
					Two quick things and I'm off:
				</p>
				<div className="mb-2.5 flex flex-wrap gap-[7px]">
					<button
						type="button"
						className="rounded-full border border-primary bg-primary px-[13px] py-[7px] text-[13px] text-primary-foreground"
					>
						Drops Friday, 8 PM
					</button>
					{["200 pairs", "Set it myself"].map((label) => (
						<button
							key={label}
							type="button"
							onClick={() => onSend?.(label)}
							className="rounded-full border border-border bg-transparent px-[13px] py-[7px] text-[13px] text-foreground transition-colors hover:bg-accent"
						>
							{label}
						</button>
					))}
				</div>
				<div className="inline-flex gap-[3px] rounded-full border border-border bg-secondary p-[3px]">
					<span className="rounded-full bg-background px-[13px] py-[5px] font-medium text-[13px] text-foreground shadow-segment">
						Hype
					</span>
					{["Minimal", "Street"].map((label) => (
						<span
							key={label}
							className="px-[13px] py-[5px] text-[13px] text-muted-foreground"
						>
							{label}
						</span>
					))}
				</div>
			</div>

			{/* 04 — user answer */}
			<div>
				<StateLabel>04 · User answer</StateLabel>
				<UserBubble>
					Aurora Void. 200 pairs, drops Friday 8 PM. Go hype.
				</UserBubble>
			</div>

			{/* 05 — build / progress panel */}
			<div>
				<StateLabel>05 · Building</StateLabel>
				<WanditMessageHeader />
				<div className="rounded-xl border border-border bg-background p-[15px]">
					<div className="mb-2.5 flex items-center justify-between">
						<span className="font-medium text-foreground text-sm">
							Landing page · v1
						</span>
						<span className="text-muted-foreground text-xs">72%</span>
					</div>
					<div className="mb-[13px] h-1 overflow-hidden rounded-full bg-border">
						<div className="h-full w-[72%] rounded-full bg-gradient-ember" />
					</div>
					<div className="flex flex-col gap-[9px] text-[13.5px]">
						<div className="flex items-center gap-2.5 text-muted-foreground">
							<DoneCircle />
							Wrote the countdown hero
						</div>
						<div className="flex items-center gap-2.5 text-muted-foreground">
							<DoneCircle />
							Built size picker + stock meter
						</div>
						<div className="flex items-center gap-2.5 text-foreground">
							<ActiveArc />
							<span>
								Wiring the COD order form
								<BlinkingCaret />
							</span>
						</div>
						<div className="flex items-center gap-2.5 text-faint">
							<PendingRing />
							Mobile polish + pixel hooks
						</div>
					</div>
				</div>
			</div>

			{/* 06 — version card */}
			<div>
				<StateLabel>06 · Version ready</StateLabel>
				<WanditMessageHeader />
				<button
					type="button"
					className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-[11px] text-start transition-colors hover:bg-accent/40"
				>
					<span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-ember-deep">
						<span className="font-semibold text-white/90 text-xs">v1</span>
					</span>
					<span className="min-w-0 flex-1">
						<span className="block font-medium text-foreground text-sm">
							Landing page · v1
						</span>
						<span className="block text-[13px] text-muted-foreground">
							Countdown hero + COD form
						</span>
					</span>
					<span className="rounded-full border border-primary/35 px-[11px] py-1 text-ember-text text-xs">
						Current
					</span>
				</button>
			</div>

			{/* 07 — options to choose */}
			<div>
				<StateLabel>07 · Options to choose</StateLabel>
				<WanditMessageHeader />
				<p className="mb-[11px] text-[14.5px] text-foreground leading-[1.5]">
					Three directions for the hero — which fits the brand?
				</p>
				<div className="flex gap-[9px]">
					<button
						type="button"
						className="flex-1 overflow-hidden rounded-lg border-[1.5px] border-primary bg-background shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.12)]"
					>
						<span
							aria-hidden
							className="block h-[52px] bg-[linear-gradient(135deg,oklch(0.7_0.19_38),oklch(0.4_0.12_30))]"
						/>
						<span className="flex items-center justify-between px-[9px] py-[7px] text-foreground text-xs">
							Ember
							<Check className="size-3 text-primary" strokeWidth={3} />
						</span>
					</button>
					{(
						[
							["Midnight", "oklch(0.55 0.13 200)", "oklch(0.35 0.1 250)"],
							["Mint", "oklch(0.7 0.13 155)", "oklch(0.4 0.1 160)"],
						] as const
					).map(([name, from, to]) => (
						<button
							key={name}
							type="button"
							className="flex-1 overflow-hidden rounded-lg border border-border bg-background transition-colors hover:bg-accent/40"
						>
							<span
								aria-hidden
								className="block h-[52px]"
								style={{
									background: `linear-gradient(135deg, ${from}, ${to})`,
								}}
							/>
							<span className="block px-[9px] py-[7px] text-start text-muted-foreground text-xs">
								{name}
							</span>
						</button>
					))}
				</div>
			</div>

			{/* 08 — multi-action tool run */}
			<div>
				<StateLabel>08 · Multi-action run</StateLabel>
				<WanditMessageHeader />
				<div className="mb-2.5 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
					Running 4 actions
				</div>
				<div className="flex flex-col gap-[3px]">
					<div className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
						<SuccessCircle />
						Analyzed the product brief
					</div>
					<div className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
						<SuccessCircle />
						Generated 3 product shots
					</div>
					<div className="flex items-center gap-2.5 font-medium text-[13.5px] text-foreground">
						<ActiveArc />
						<span>
							Rendering the teaser
							<BlinkingCaret />
						</span>
					</div>
					<div className="flex items-center gap-2.5 text-[13.5px] text-faint">
						<PendingRing />
						Attach to Assets
					</div>
				</div>
				<div className="mt-[11px] inline-flex items-center gap-[7px] rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
					<Code className="size-3 text-primary" />
					tool · generate_image ×3
				</div>
			</div>

			{/* 09 — image generation result */}
			<div>
				<StateLabel>09 · Image result</StateLabel>
				<WanditMessageHeader />
				<p className="mb-2.5 text-[14.5px] text-foreground leading-[1.5]">
					Here's the lead product shot for the drop:
				</p>
				<div className="overflow-hidden rounded-[14px] border border-border">
					<div className="relative grid h-[150px] place-items-center bg-[radial-gradient(120%_90%_at_30%_20%,oklch(0.55_0.14_55),oklch(0.2_0.08_30))]">
						<div aria-hidden className="absolute inset-0 bg-grain" />
						<SneakerArt />
						<span className="absolute start-[9px] bottom-[9px] rounded-[6px] bg-black/30 px-[7px] py-0.5 font-mono text-[9px] text-white/70 tracking-[0.08em]">
							1024×1024 · flux
						</span>
					</div>
					<div className="flex gap-[7px] bg-background p-2.5">
						<Button size="sm" className="h-8 flex-1 text-[13px]">
							Use on page
						</Button>
						<Button size="sm" variant="outline" className="h-8 text-[13px]">
							Redo
						</Button>
					</div>
				</div>
			</div>

			{/* 10 — video generation result */}
			<div>
				<StateLabel>10 · Video result</StateLabel>
				<WanditMessageHeader />
				<p className="mb-2.5 text-[14.5px] text-foreground leading-[1.5]">
					And a 6-second teaser for the ads:
				</p>
				<div className="overflow-hidden rounded-[14px] border border-border">
					<div className="relative grid h-[150px] place-items-center bg-[linear-gradient(135deg,oklch(0.3_0.09_40),oklch(0.15_0.05_280))]">
						<div aria-hidden className="absolute inset-0 bg-grain" />
						<span className="grid size-[46px] place-items-center rounded-full border border-white/30 bg-white/16 backdrop-blur-sm">
							<Play className="size-[17px] fill-white text-white" />
						</span>
						<span className="absolute end-[9px] bottom-[9px] rounded-[6px] bg-black/45 px-[7px] py-0.5 font-mono text-[10px] text-white">
							0:06
						</span>
						<div className="absolute inset-x-[11px] bottom-2.5 h-[3px] rounded-full bg-white/20">
							<div className="h-full w-[35%] rounded-full bg-ember-1" />
						</div>
					</div>
					<div className="flex gap-[7px] bg-background p-2.5">
						<Button size="sm" className="h-8 flex-1 text-[13px]">
							Download MP4
						</Button>
						<Button size="sm" variant="outline" className="h-8 text-[13px]">
							Redo
						</Button>
					</div>
				</div>
			</div>

			{/* 11 — thinking / typing dots */}
			<div>
				<StateLabel>11 · Thinking</StateLabel>
				<WanditMessageHeader />
				<div className="flex items-center gap-1 ps-0.5">
					{[0, 1, 2].map((i) => (
						<span
							key={i}
							aria-hidden
							className="size-1.5 animate-bounce-dot rounded-full bg-muted-foreground"
							style={{ animationDelay: `${i * 0.15}s` }}
						/>
					))}
				</div>
			</div>

			{/* 12 — out of credits (error) */}
			<div>
				<StateLabel>12 · Out of credits</StateLabel>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker="Can't generate"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						className="size-3"
						aria-hidden
						role="presentation"
					>
						<path
							d="M12 8v5M12 16h.01"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
						/>
					</svg>
				</StatusMessageHeader>
				<div className="rounded-[14px] border border-destructive/30 bg-destructive/5 p-[14px]">
					<p className="mb-1 font-medium text-foreground text-sm">
						You're out of credits.
					</p>
					<p className="mb-[13px] text-[13px] text-muted-foreground leading-[1.5]">
						Regenerating all shots needs{" "}
						<span className="font-mono text-ember-text">12</span> credits — you
						have <span className="font-mono text-ember-text">1</span>.
					</p>
					<div className="flex gap-2">
						<Button size="sm" className="h-8 flex-1 text-[13px]">
							Top up wallet
						</Button>
						<Button size="sm" variant="outline" className="h-8 text-[13px]">
							Upgrade
						</Button>
					</div>
				</div>
			</div>

			{/* 13 — published (success) */}
			<div>
				<StateLabel>13 · Published</StateLabel>
				<StatusMessageHeader
					avatarClass="border-success/40 bg-success/16 text-success"
					kickerClass="text-success"
					kicker="Published · Live"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						className="size-3"
						aria-hidden
						role="presentation"
					>
						<path
							d="m5 12 4.5 4.5L19 7"
							stroke="currentColor"
							strokeWidth="2.4"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</StatusMessageHeader>
				<div className="relative overflow-hidden rounded-[14px] border border-success/30 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--success)_8%,transparent),color-mix(in_oklab,var(--primary)_4%,transparent))] p-[15px]">
					{/* Confetti dots — top-right corner celebration (dc reference). */}
					<span
						aria-hidden
						className="absolute end-[15px] top-[11px] size-1 rounded-full bg-ember-1"
					/>
					<span
						aria-hidden
						className="absolute end-[31px] top-[23px] size-[3px] rounded-full bg-success"
					/>
					<span
						aria-hidden
						className="absolute end-[53px] top-[17px] size-[3px] rounded-full bg-primary"
					/>
					<p className="mb-[3px] font-semibold text-base text-foreground">
						Your page is live.
					</p>
					<p className="mb-3 text-[13px] text-muted-foreground">
						Point your ads here and start collecting orders.
					</p>
					<div className="mb-[11px] flex items-center gap-2 rounded-[11px] border border-border bg-background px-3 py-2">
						<Lock className="size-[13px] shrink-0 text-success" />
						<span className="flex-1 font-mono text-[12.5px] text-ember-text">
							aurora-void.wandit.app
						</span>
						<Copy className="size-3.5 cursor-pointer text-muted-foreground" />
					</div>
					<Button size="sm" className="h-9 w-full text-[13.5px]">
						View live page
					</Button>
				</div>
			</div>
		</div>
	);
}
