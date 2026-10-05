/**
 * The sentence of the hero: "Build me a [mobile app]" in giant type, then the
 * prompt box that holds the rest of the sentence. The platform word is a
 * button that flips between mobile and web. hero.tsx owns all state and the
 * form. This file draws the sentence, the box, the ghost text of the idle
 * loop, and the build button.
 */

import type { TargetPlatform } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { KeyboardEvent, RefObject } from "react";

import { Spark } from "@/components/logo";
import { OutOfCreditsBanner } from "@/features/credits";
import { useDictionary } from "@/lib/i18n";

import { KeycapButton } from "./keycap-button";
import { PlatformToken } from "./platform-token";

/** What the idle loop draws in place of the empty input. */
type HeroGhost = {
	/** The part of the idea typed so far. */
	text: string;
	/** True when the caret blinks: the hero is on screen and no letter arrives. A typing caret stays solid. */
	isBlinking: boolean;
	/** True just before the loop erases the text. The text shows as selected. */
	isSelected: boolean;
};

type HeroSentenceProps = {
	platform: TargetPlatform;
	/** Flips the platform word. hero.tsx also swaps the app on the stage. */
	onFlipPlatform: () => void;
	/** Text the visitor wrote in the box, after the platform word. */
	value: string;
	onValueChange: (value: string) => void;
	/** Text of the idle loop, or null when the visitor has taken the input. */
	ghost: HeroGhost | null;
	/** Idea text that the empty box shows in a light color. */
	placeholder: string;
	/** All idea texts of the loop. They reserve the height of the longest one, so nothing below jumps. */
	reservedTexts: readonly string[];
	/** Maximum length of `value`, so the full sentence fits the server limit. */
	maxLength: number;
	onFocus: () => void;
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	/** True when a signed-in visitor has no credits. Blocks the box and the button, and shows the credits strip on the box. */
	disabled: boolean;
	/** True while a create runs. Blocks a second send. */
	isSubmitting: boolean;
};

/** Ends the text copy, so a trailing new line still adds a line of height. */
const ZERO_WIDTH_SPACE = "​";

/** The sentence: lead words and the platform token, then the prompt box. */
export function HeroSentence({
	platform,
	onFlipPlatform,
	value,
	onValueChange,
	ghost,
	placeholder,
	reservedTexts,
	maxLength,
	onFocus,
	textareaRef,
	disabled,
	isSubmitting,
}: HeroSentenceProps) {
	const hero = useDictionary().landing.hero;
	const showGhost = ghost !== null && value === "";

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		// Enter sends, Shift+Enter adds a line. Enter that confirms an IME word
		// does not send: Safari reports it with keyCode 229, not isComposing.
		if (
			event.key !== "Enter" ||
			event.shiftKey ||
			event.nativeEvent.isComposing ||
			event.keyCode === 229
		) {
			return;
		}
		event.preventDefault();
		event.currentTarget.form?.requestSubmit();
	}

	return (
		<div>
			{/* On desktop the size also follows the viewport height, so the sentence,
			    the box and the sub line fit on one screen. Arabic glyphs are wider, so its size is smaller. */}
			<p className="font-extrabold text-[clamp(2.6rem,6.4vw,6.75rem)] leading-[0.95] tracking-[-0.045em] lg:text-[clamp(3rem,min(6vw,10svh),6.75rem)] rtl:text-[clamp(2.25rem,5.6vw,5.25rem)] rtl:leading-[1.3] rtl:tracking-normal lg:rtl:text-[clamp(2.6rem,min(4.8vw,8svh),5.25rem)]">
				{hero.leadStart}{" "}
				<PlatformToken platform={platform} onFlip={onFlipPlatform} />
			</p>

			{/* The credits strip is product UI and paints with the primary color. Primary is
			    ember, the color of this panel, so night replaces it here. */}
			<div className="mt-7 text-night [--primary-foreground:var(--color-paper)] [--primary:var(--color-night)]">
				<OutOfCreditsBanner active={disabled} className="rounded-[2.25rem]">
					{/* The box is a big key, like the build button: a paper face on an ember-deep
					    edge. It rises a little while the textarea has the focus. */}
					<div
						className={cn(
							"rounded-[1.75rem] bg-paper text-night outline-white outline-offset-4 transition-[translate,box-shadow] duration-150 ease-out [--box-depth:7px] md:rounded-[2rem]",
							"shadow-[0_var(--box-depth)_0_var(--color-ember-deep)] has-[textarea:focus]:-translate-y-0.5 has-[textarea:focus]:shadow-[0_calc(var(--box-depth)+2px)_0_var(--color-ember-deep)] has-[textarea:focus-visible]:outline-2",
						)}
					>
						{/* One grid cell holds the reserved texts, the textarea and its text
						    copy. The tallest layer sets the height, so the box grows with no script. */}
						<div className="grid px-5 pt-5 font-semibold text-[clamp(1.3rem,2.1vw,1.85rem)] leading-[1.2] tracking-[-0.02em] md:px-7 md:pt-6 rtl:leading-[1.6] rtl:tracking-normal">
							{reservedTexts.map((text) => (
								<span
									key={text}
									aria-hidden
									className="invisible whitespace-pre-wrap break-words [grid-area:1/1]"
								>
									{text}
								</span>
							))}
							<textarea
								ref={textareaRef}
								rows={1}
								value={value}
								onChange={(event) => onValueChange(event.target.value)}
								onFocus={onFocus}
								onKeyDown={handleKeyDown}
								placeholder={showGhost ? undefined : placeholder}
								aria-label={hero.inputLabel}
								maxLength={maxLength}
								disabled={disabled}
								autoComplete="off"
								// Five lines at most, then the box scrolls, so the button stays in view.
								className="max-h-[6em] resize-none overflow-y-auto bg-transparent text-night caret-ember outline-none [grid-area:1/1] placeholder:text-night/45 disabled:cursor-not-allowed disabled:text-night/60 rtl:max-h-[8em]"
							/>
							{/* The copy of the textarea text sets the height. The idle loop draws its ghost here. */}
							<span
								aria-hidden
								className={cn(
									"pointer-events-none max-h-[6em] self-start overflow-hidden whitespace-pre-wrap break-words [grid-area:1/1] rtl:max-h-[8em]",
									!showGhost && "text-transparent",
								)}
							>
								{showGhost ? (
									<>
										<span
											className={cn(
												"rounded-[0.12em] box-decoration-clone transition-colors duration-150",
												ghost.isSelected && "bg-spark",
											)}
										>
											{ghost.text}
										</span>
										<GhostCaret isBlinking={ghost.isBlinking} />
									</>
								) : (
									`${value || placeholder}${ZERO_WIDTH_SPACE}`
								)}
							</span>
						</div>

						<div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 px-4 pt-5 pb-4 md:px-5 md:pb-5">
							<span className="me-auto ps-1 font-medium text-night/70 text-sm md:ps-2 md:text-[15px]">
								{hero.ctaHint}
							</span>
							<KeycapButton
								type="submit"
								size="md"
								disabled={disabled || isSubmitting}
								// The face is spark on paper, so the focus outline is night here.
								className="focus-visible:outline-night"
							>
								<Spark className="size-4" />
								{hero.cta}
							</KeycapButton>
						</div>
					</div>
				</OutOfCreditsBanner>
			</div>
		</div>
	);
}

/**
 * The thick ember caret of the ghost text. Its margins cancel its width, so
 * it never changes where a line wraps. It blinks at 1.1 s per cycle, near a real caret.
 */
function GhostCaret({ isBlinking }: { isBlinking: boolean }) {
	const reduceMotion = useReducedMotion() ?? false;
	const shouldBlink = isBlinking && !reduceMotion;

	return (
		<motion.span
			animate={shouldBlink ? { opacity: [1, 1, 0, 0] } : { opacity: 1 }}
			transition={
				shouldBlink
					? {
							duration: 1.1,
							times: [0, 0.5, 0.5, 1],
							repeat: Number.POSITIVE_INFINITY,
							ease: "linear",
						}
					: { duration: 0 }
			}
			className="ms-[0.04em] -me-[0.12em] inline-block h-[1em] w-[0.09em] translate-y-[0.16em] rounded-full bg-ember"
		/>
	);
}
