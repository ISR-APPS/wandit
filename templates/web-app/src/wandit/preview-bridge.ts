// Dev-only bridge between the preview iframe and the wandit host.
// The root route calls installPreviewBridge() at module load when import.meta.env.DEV.
// Posts runtime errors, console.error calls, and Vite compile errors to window.parent
// so the host can show them.
// Runs the select mode: a click posts the data-wandit-src value of the element.
// vite-plugins/wandit-source.ts writes that attribute on each JSX element in dev.
import { z } from "zod";

type BridgeMessage =
	| { type: "wandit:bridge-ready" }
	| { type: "wandit:runtime-error"; message: string; stack?: string }
	| { type: "wandit:select-source"; src: string; tag: string; label: string }
	| { type: "wandit:deselect" };

// The host drops a longer text, so the bridge cuts each text to these lengths.
const MESSAGE_MAX_LENGTH = 1000;
const STACK_MAX_LENGTH = 4000;
const LABEL_MAX_LENGTH = 80;

const SOURCE_ATTRIBUTE = "data-wandit-src";

// Above every z-index the app can set, so the outline is never hidden.
const OUTLINE_Z_INDEX = "2147483647";

let installed = false;
/** Origin of the host that started the select mode. Null while the mode is off. */
let selectOrigin: string | null = null;
/** Removes the select mode listeners. Null while the mode is off. */
let selectAbort: AbortController | null = null;
/** The hover outline. Made on the first hover; a client render of the root can remove it from the body. */
let outline: HTMLDivElement | null = null;

function post(message: BridgeMessage, targetOrigin: string) {
	window.parent.postMessage(message, targetOrigin);
}

/**
 * The first `max` UTF-16 units of `text`. A cut through an emoji leaves half
 * a pair, and the database of the host refuses that text, so the half drops.
 */
function cut(text: string, max: number): string {
	return text.slice(0, max).replace(/[\uD800-\uDBFF]$/, "");
}

function postError(message: string, stack?: string) {
	// The stack frames name the dev server origin. Without it, the agent reads plain file paths.
	const shortStack =
		stack === undefined
			? undefined
			: cut(stack.replaceAll(window.location.origin, ""), STACK_MAX_LENGTH);
	// The bridge does not know the host origin before the host posts to it.
	// The preview proxy lets only the wandit origins frame the app.
	post(
		{
			type: "wandit:runtime-error",
			message: cut(message, MESSAGE_MAX_LENGTH) || "Unknown error",
			stack: shortStack,
		},
		"*",
	);
}

/** Text of one console value. An Error gives its message. */
function textOf(value: unknown): string {
	return value instanceof Error ? value.message : String(value);
}

/**
 * Text of one console.error call. React logs with a format string, for
 * example "%o\n\n%s", so the slots get the next arguments, as in the console.
 */
function consoleText(args: unknown[]): string {
	const [first, ...rest] = args;
	if (typeof first !== "string") {
		return args.map(textOf).join(" ");
	}
	const filled = first.replace(/%[sdifoOc]/g, (slot) => {
		const value = rest.shift();
		// %c takes a CSS string. It has no text.
		return slot === "%c" ? "" : textOf(value);
	});
	return [filled, ...rest.map(textOf)].join(" ").trim();
}

/** The nearest element with a source attribute, or null. */
function sourceElementOf(target: EventTarget | null): Element | null {
	return target instanceof Element
		? target.closest(`[${SOURCE_ATTRIBUTE}]`)
		: null;
}

/** Short text that names the element for the user and the agent. */
function labelOf(element: Element): string {
	const text =
		element instanceof HTMLElement
			? element.innerText
			: (element.textContent ?? "");
	const name =
		text.trim() ||
		element.getAttribute("aria-label") ||
		element.getAttribute("alt") ||
		element.getAttribute("placeholder") ||
		"";
	return cut(name.replace(/\s+/g, " ").trim(), LABEL_MAX_LENGTH);
}

function showOutline(element: Element | null) {
	if (element === null) {
		if (outline !== null) outline.style.display = "none";
		return;
	}
	if (outline === null) {
		outline = document.createElement("div");
		Object.assign(outline.style, {
			position: "fixed",
			pointerEvents: "none",
			zIndex: OUTLINE_Z_INDEX,
			border: "2px solid #f97316",
			borderRadius: "4px",
			boxSizing: "border-box",
		});
	}
	if (!outline.isConnected) {
		document.body.append(outline);
	}
	const rect = element.getBoundingClientRect();
	Object.assign(outline.style, {
		display: "block",
		top: `${rect.top}px`,
		left: `${rect.left}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`,
	});
}

/** Blocks the app handlers, so a click in select mode picks and does nothing else. */
function swallow(event: Event) {
	event.preventDefault();
	event.stopPropagation();
}

function onSelectClick(event: MouseEvent) {
	swallow(event);
	const element = sourceElementOf(event.target);
	const src = element?.getAttribute(SOURCE_ATTRIBUTE);
	if (!element || !src || selectOrigin === null) {
		return;
	}
	post(
		{
			type: "wandit:select-source",
			src,
			tag: element.tagName.toLowerCase(),
			label: labelOf(element),
		},
		selectOrigin,
	);
}

function onSelectKeyDown(event: KeyboardEvent) {
	if (event.key !== "Escape" || selectOrigin === null) {
		return;
	}
	event.preventDefault();
	post({ type: "wandit:deselect" }, selectOrigin);
}

function startSelectMode(hostOrigin: string) {
	selectOrigin = hostOrigin;
	if (selectAbort !== null) {
		return;
	}
	selectAbort = new AbortController();
	// Capture on window runs before the handlers of the app.
	const options = { capture: true, signal: selectAbort.signal };
	window.addEventListener(
		"pointermove",
		(event) => showOutline(sourceElementOf(event.target)),
		options,
	);
	// A scroll moves the element, so the old outline is wrong until the next move.
	window.addEventListener("scroll", () => showOutline(null), options);
	// No related target: the pointer left the frame, so no element is under it.
	window.addEventListener(
		"pointerout",
		(event) => {
			if (event.relatedTarget === null) showOutline(null);
		},
		options,
	);
	window.addEventListener("click", onSelectClick, options);
	for (const type of [
		"pointerdown",
		"pointerup",
		"mousedown",
		"mouseup",
		"dblclick",
		"auxclick",
		"contextmenu",
	]) {
		window.addEventListener(type, swallow, options);
	}
	window.addEventListener("keydown", onSelectKeyDown, options);
}

function stopSelectMode() {
	selectOrigin = null;
	selectAbort?.abort();
	selectAbort = null;
	showOutline(null);
}

/** Attaches the listeners once. Safe to call more than once. */
export function installPreviewBridge() {
	// Outside the builder frame no host listens.
	if (installed || typeof window === "undefined" || window.parent === window) {
		return;
	}
	installed = true;

	window.addEventListener("error", (event) => {
		postError(
			event.message,
			event.error instanceof Error ? event.error.stack : undefined,
		);
	});

	window.addEventListener("unhandledrejection", (event) => {
		const reason: unknown = event.reason;
		const message = reason instanceof Error ? reason.message : String(reason);
		const stack = reason instanceof Error ? reason.stack : undefined;
		postError(message, stack);
	});

	// Vite shows a compile error only in its overlay, so the bridge reads the HMR event too.
	import.meta.hot?.on("vite:error", (payload) => {
		postError(payload.err.message, payload.err.stack);
	});

	// React reports the errors that an error boundary caught with console.error.
	const consoleError = console.error;
	console.error = (...args: unknown[]) => {
		consoleError.apply(console, args);
		try {
			const error = args.find((arg): arg is Error => arg instanceof Error);
			postError(consoleText(args), error?.stack);
		} catch (error) {
			// String() throws on some values, like an object with no prototype.
			// A console.error call of the app must never throw because of the bridge.
			consoleError.call(
				console,
				"wandit bridge: cannot post console.error",
				error,
			);
		}
	};

	// The host posts this to start or stop the select mode. The schema is built
	// here, not at module level, so the production build drops this module.
	const selectModeMessageSchema = z.object({
		type: z.literal("wandit:select-mode"),
		active: z.boolean(),
	});
	window.addEventListener("message", (event) => {
		// Only the host window that frames the app may switch the mode.
		if (event.source !== window.parent) {
			return;
		}
		const parsed = selectModeMessageSchema.safeParse(event.data);
		if (!parsed.success) {
			return;
		}
		if (parsed.data.active) {
			startSelectMode(event.origin);
		} else {
			stopSelectMode();
		}
	});

	// A page load resets the select mode. The host answers ready with its current mode.
	post({ type: "wandit:bridge-ready" }, "*");
}
