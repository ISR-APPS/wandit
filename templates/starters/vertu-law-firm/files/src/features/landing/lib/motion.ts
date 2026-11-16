// Inline style helpers for the CSS motion of landing.css. The hero, the reveals, and the drawer read them.
// Each helper sets one custom property; landing.css turns it into a delay or a transform.
import type { CSSProperties } from "react";

/** A style that holds only the `--delay` property of the entrance animations. */
type DelayStyle = CSSProperties & Record<"--delay", string>;

/** The start delay of one entrance, in milliseconds. The hero overlaps its entrances, so the steps are short. */
export function enterDelay(milliseconds: number): DelayStyle {
	return { "--delay": `${milliseconds}ms` };
}

/** A style that holds the index of a folder and the fan share of the drawer. */
type FanStyle = CSSProperties & Record<"--i" | "--fan", string>;

/** The fan offset of folder `index`: landing.css moves its tab by index x -26px x (1 - fan). */
export function fanStyle(index: number, fan: number): FanStyle {
	return { "--i": String(index), "--fan": String(fan) };
}
