// The preview-only editor script + style injected into the iframe srcDoc
// (contract §11). NEVER part of canonical/published HTML — the server strips
// any element whose id starts with "__wandit-" on every save (contract §5).
// Plain ES2017, no imports, no network requests; it only talks to the parent
// via postMessage using the envelope in messages.ts. Both strings avoid
// backticks and "${" so they can live in template literals, and the script
// contains no "</script" sequence that would break the HTML injection.

/** id of the injected <style> — stripped server-side, never persisted. */
export const EDITOR_STYLE_ID = "__wandit-editor-style";
/** id of the injected <script> — stripped server-side, never persisted. */
export const EDITOR_SCRIPT_ID = "__wandit-editor";

// Hardcoded highlight colors (contract §11) — never touching page tokens.
// The data-wandit-mode attribute is mirrored by the script (iframe-only,
// never persisted) so images stop being natively draggable while targeting
// or editing — a drag would otherwise eat the click.
export const EDITOR_STYLE = `
#__wandit-hover-box, #__wandit-select-box, .__wandit-ai-box { position: fixed; left: 0; top: 0; margin: 0; padding: 0; box-sizing: border-box; border: 2px dashed #f97316; background: transparent; pointer-events: none; z-index: 2147483647; display: none; }
#__wandit-select-box { border-style: solid; }
.__wandit-ai-box { border: 3px solid #8b5cf6; border-radius: 6px; box-shadow: 0 0 0 3px rgb(139 92 246 / 0.18); }
.__wandit-ai-box.__wandit-ai-pulse { animation: __wandit-ai-pulse 1.15s ease-in-out infinite; }
.__wandit-comment-pin { position: fixed; left: 0; top: 0; min-width: 24px; height: 24px; margin: 0; padding: 0 6px; box-sizing: border-box; border: 2px solid #fff; border-radius: 999px; background: #f97316; color: #fff; box-shadow: 0 2px 8px rgb(15 23 42 / 0.28); font: 700 12px/20px ui-sans-serif, system-ui, sans-serif; text-align: center; pointer-events: none; z-index: 2147483647; display: none; }
@keyframes __wandit-ai-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; box-shadow: 0 0 0 7px rgb(139 92 246 / 0.08); } }
[contenteditable="true"][data-wid] { cursor: text; }
:root[data-wandit-mode="select"] img, :root[data-wandit-mode="edit"] img { -webkit-user-drag: none; user-drag: none; }
`.trim();

export const EDITOR_SCRIPT = `
(function () {
	"use strict";
	var MODE = "browse";
	var SELECTED = null;
	var HOVERED = null;
	var AI_TARGETS = new Map();
	var COMMENT_PINS = new Map();
	var EDITING = null;
	var SUSPENDED = false;
	var ACTIVE_LADDER = null;
	var HOVER_BOX = null;
	var SELECT_BOX = null;
	var OVERLAY_ID = 0;
	var RAF = 0;
	var POINTER_RAF = 0;
	var LAST_POINTER = null;
	var LAST_SELECTION_RECT = null;
	var PENDING_SELECTION_RECT = null;
	var SELECTION_RECT_PENDING = false;

	function post(type, payload) {
		try {
			window.parent.postMessage(
				{
					source: "wandit-preview",
					v: 1,
					type: type,
					payload: typeof payload === "undefined" ? {} : payload
				},
				"*"
			);
		} catch (e) {
			/* parent gone — nothing to do */
		}
	}

	function byWid(wid) {
		var escaped =
			window.CSS && CSS.escape ? CSS.escape(wid) : wid.replace(/["\\\\]/g, "");
		return document.querySelector('[data-wid="' + escaped + '"]');
	}

	var SECTION_TAGS = ["HEADER", "SECTION", "FOOTER", "ASIDE", "NAV"];
	var GENERIC_SECTION_WRAPPER_TAGS = ["DIV", "MAIN"];
	var MAX_SECTION_WRAPPER_DEPTH = 2;
	var CONTAINER_TAGS = ["DIV", "FIGURE", "ARTICLE"];
	var LEAF_TAGS = [
		"H1", "H2", "H3", "H4", "H5", "H6", "P", "LI", "BLOCKQUOTE",
		"FIGCAPTION", "LABEL", "LEGEND", "INPUT", "TEXTAREA", "IMG", "A", "BUTTON"
	];
	var EDITABLE_TEXT_TAGS = [
		"H1", "H2", "H3", "H4", "H5", "H6", "P", "LI", "BLOCKQUOTE",
		"FIGCAPTION", "LABEL", "LEGEND", "SPAN", "A", "BUTTON"
	];
	var INLINE_FORMATTING_TAGS = [
		"EM", "I", "STRONG", "B", "U", "S", "SMALL", "MARK", "SUB", "SUP",
		"BR", "SPAN", "A"
	];

	// Structural mirror of apps/server/src/modules/pages/domain/stamp.ts — that
	// file is the source of truth. A section-ish tag may pierce at most two
	// generic DIV/MAIN wrappers, with no intervening section-ish ancestor.
	function isTopSection(el) {
		if (!el.tagName || SECTION_TAGS.indexOf(el.tagName) < 0) return false;
		var ancestor = el.parentElement;
		var wrapperDepth = 0;
		while (ancestor && ancestor.tagName !== "BODY") {
			if (
				SECTION_TAGS.indexOf(ancestor.tagName) >= 0 ||
				GENERIC_SECTION_WRAPPER_TAGS.indexOf(ancestor.tagName) < 0
			) {
				return false;
			}
			wrapperDepth += 1;
			if (wrapperDepth > MAX_SECTION_WRAPPER_DEPTH) return false;
			ancestor = ancestor.parentElement;
		}
		return !!ancestor && ancestor.tagName === "BODY";
	}

	// Exact leaf and inline-formatting mirror of stamp.ts, the source of truth.
	// SVG descendants are artwork, not targets.
	function hasOnlyInlineFormatting(el) {
		var stack = [];
		var children = el.children || [];
		for (var i = 0; i < children.length; i++) stack.push(children[i]);
		while (stack.length > 0) {
			var child = stack.pop();
			if (!child.tagName || INLINE_FORMATTING_TAGS.indexOf(child.tagName) < 0) {
				return false;
			}
			var descendants = child.children || [];
			for (var j = 0; j < descendants.length; j++) stack.push(descendants[j]);
		}
		return true;
	}

	function isStampableLeaf(el) {
		if (!el || !el.tagName || el.closest("svg")) return false;
		if (el.tagName === "SPAN") return hasOnlyInlineFormatting(el);
		return LEAF_TAGS.indexOf(el.tagName) >= 0;
	}

	function isFormSubmitControl(el) {
		if (!el || !el.tagName) return false;
		var type = String(el.getAttribute("type") || "").trim().toLowerCase();
		if (el.tagName === "BUTTON") {
			// Missing and invalid button types use the browser's submit default.
			return type !== "button" && type !== "reset";
		}
		return el.tagName === "INPUT" && (type === "submit" || type === "image");
	}

	// Client mirror of the server's lead-capture guard. The server remains the
	// authority, but protected controls must not advertise (or live-apply) an
	// operation that persistence will reject.
	function isRemovable(el) {
		if (!isStampableLeaf(el)) return false;
		var form = el.closest("form");
		if (!form) return true;
		if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return false;
		if (!isFormSubmitControl(el)) return true;
		var controls = form.querySelectorAll("button, input");
		var submitControlCount = 0;
		for (var i = 0; i < controls.length; i++) {
			if (isFormSubmitControl(controls[i])) submitControlCount += 1;
		}
		return submitControlCount !== 1;
	}

	// Text edits intentionally flatten inline formatting, stamped or not. Any
	// non-inline descendant (for example a label's phone input) stays protected.
	function isEditableTextLeaf(el) {
		return (
			EDITABLE_TEXT_TAGS.indexOf(el.tagName) >= 0 &&
			hasOnlyInlineFormatting(el)
		);
	}

	// The enclosing top-level section (self included), or null for floating
	// elements living outside every section.
	function sectionOf(el) {
		var cur = el;
		while (cur) {
			if (isTopSection(cur)) return cur;
			cur = cur.parentElement;
		}
		return null;
	}

	// Structural mirror of stamp.ts's separate container predicate. Containers
	// are addressable surfaces, but never inherit editable-leaf/removal rules.
	function isStampableContainer(el) {
		if (!el || !el.tagName || CONTAINER_TAGS.indexOf(el.tagName) < 0) return false;
		if (el.closest("svg") || el.closest("form")) return false;
		var section = sectionOf(el);
		return !!section && section !== el;
	}

	function colorAlpha(raw) {
		var value = String(raw || "").trim().toLowerCase();
		if (!value || value === "transparent") return 0;
		var slash = /\\/\\s*([+-]?(?:\\d*\\.)?\\d+)(%)?\\s*\\)$/.exec(value);
		if (slash && slash[1]) {
			return Number(slash[1]) / (slash[2] ? 100 : 1);
		}
		var comma = /,\\s*([+-]?(?:\\d*\\.)?\\d+)(%)?\\s*\\)$/.exec(value);
		if (
			comma &&
			comma[1] &&
			(value.indexOf("rgba(") === 0 || value.indexOf("hsla(") === 0)
		) {
			return Number(comma[1]) / (comma[2] ? 100 : 1);
		}
		return 1;
	}

	function alphaIsVisible(raw) {
		return colorAlpha(raw) > 0;
	}

	function alphaIsOpaque(raw) {
		return colorAlpha(raw) >= 1;
	}

	function backgroundImageLayers(value) {
		var layers = [];
		var start = 0;
		var depth = 0;
		var quote = null;
		var escaped = false;
		for (var i = 0; i < value.length; i++) {
			var character = value.charAt(i);
			if (quote) {
				if (escaped) escaped = false;
				else if (character === "\\\\") escaped = true;
				else if (character === quote) quote = null;
				continue;
			}
			if (character === '"' || character === "'") {
				quote = character;
			} else if (character === "(") {
				depth += 1;
			} else if (character === ")") {
				if (depth > 0) depth -= 1;
			} else if (character === "," && depth === 0) {
				layers.push(value.slice(start, i).trim());
				start = i + 1;
			}
		}
		layers.push(value.slice(start).trim());
		return layers;
	}

	function gradientLayerIsOpaque(layer) {
		if (/(^|[,(\\s])transparent(?=[,\\s)])/.test(layer)) return false;
		var colors = layer.match(/(?:rgba?|hsla?|color)\\([^)]*\\)/g) || [];
		for (var i = 0; i < colors.length; i++) {
			if (!alphaIsOpaque(colors[i])) return false;
		}
		return true;
	}

	// Background-image opacity is layer-compositional: any opaque layer hides
	// content below the surface, even when translucent gradients sit above it.
	function backgroundImageIsOpaque(raw) {
		var value = String(raw || "").trim().toLowerCase();
		if (!value || value === "none") return false;
		var layers = backgroundImageLayers(value);
		for (var i = 0; i < layers.length; i++) {
			var layer = layers[i];
			if (!layer || layer === "none") continue;
			if (
				layer.indexOf("gradient(") < 0 ||
				gradientLayerIsOpaque(layer)
			) return true;
		}
		return false;
	}

	// "opaque" stops the hit-stack scan; "pending" remains a breadcrumb while
	// a lower stamped leaf is sought; "none" is click-through paint.
	function surfaceHitState(el) {
		if (!isStampableContainer(el) || !el.getAttribute("data-wid")) return "none";
		var cs = window.getComputedStyle(el);
		if (
			backgroundImageIsOpaque(cs.backgroundImage) ||
			alphaIsOpaque(cs.backgroundColor)
		) return "opaque";
		if (cs.backgroundImage !== "none" || alphaIsVisible(cs.backgroundColor)) {
			return "pending";
		}
		return "none";
	}

	function isVisibleSurface(el) {
		return surfaceHitState(el) !== "none";
	}

	function closestStampedLeaf(target) {
		var candidate = target && target.closest ? target.closest("[data-wid]") : null;
		while (candidate) {
			if (isStampableLeaf(candidate)) return candidate;
			var parent = candidate.parentElement;
			candidate = parent && parent.closest ? parent.closest("[data-wid]") : null;
		}
		return null;
	}

	function closestVisibleSurface(target) {
		var candidate = target && target.closest ? target.closest("[data-wid]") : null;
		while (candidate) {
			if (isVisibleSurface(candidate)) return candidate;
			var parent = candidate.parentElement;
			candidate = parent && parent.closest ? parent.closest("[data-wid]") : null;
		}
		return null;
	}

	function containsPoint(el, x, y) {
		if (typeof x !== "number" || typeof y !== "number") return true;
		var rect = el.getBoundingClientRect();
		return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
	}

	function normalizedVisibleText(el) {
		var raw = typeof el.innerText === "string" ? el.innerText : el.textContent;
		var text = String(raw || "")
			.replace(/\\s+/g, " ")
			.trim();
		return text ? text.slice(0, 120) : null;
	}

	function kindOf(el) {
		return isTopSection(el)
			? "section"
			: isStampableContainer(el)
				? "surface"
				: "element";
	}

	function stopFor(el) {
		var excerpt = normalizedVisibleText(el);
		var label = String(
			excerpt || el.getAttribute("aria-label") || el.tagName.toLowerCase()
		)
			.replace(/\\s+/g, " ")
			.trim()
			.slice(0, 120);
		return {
			el: el,
			wid: el.getAttribute("data-wid"),
			kind: kindOf(el),
			tag: el.tagName.toLowerCase(),
			label: label || el.tagName.toLowerCase()
		};
	}

	function dedupeStops(elements) {
		var stops = [];
		var seen = Object.create(null);
		for (var i = 0; i < elements.length; i++) {
			var element = elements[i];
			if (!element) continue;
			var wid = element.getAttribute("data-wid");
			if (!wid || seen[wid]) continue;
			seen[wid] = true;
			stops.push(stopFor(element));
		}
		return stops;
	}

	// A stamped IMG covering >= 90% of BOTH axes of its top-level section is
	// that section's de-facto BACKGROUND — hover/click should land on the
	// section, and its controls own the image (V4 full-bleed rule).
	function coversSection(img, section) {
		var ir = img.getBoundingClientRect();
		var sr = section.getBoundingClientRect();
		if (sr.width <= 0 || sr.height <= 0) return false;
		return ir.width >= sr.width * 0.9 && ir.height >= sr.height * 0.9;
	}

	// Resolve one point into a deep-first ladder. All hit testing, visible-
	// surface qualification, coordinates, and promotion metadata stay in this
	// iframe so parent breadcrumbs cannot desynchronize DOM/overlay state.
	function makeLadder(stops, x, y, promotedBgImg, direct) {
		if (stops.length === 0) return null;
		return {
			x: direct ? null : x,
			y: direct ? null : y,
			signature: direct
				? null
				: stops.map(function (stop) { return stop.wid; }).join("|"),
			stops: stops,
			index: 0,
			promotedBgImg: promotedBgImg,
			direct: !!direct
		};
	}

	function ladderForLeaf(leaf, pendingSurface, x, y, direct) {
		var leafSection = sectionOf(leaf);
		if (
			leaf.tagName === "IMG" &&
			leafSection &&
			leafSection.getAttribute("data-wid") &&
			coversSection(leaf, leafSection)
		) {
			return makeLadder(
				dedupeStops([leafSection]),
				x,
				y,
				leaf,
				direct
			);
		}

		var surface =
			pendingSurface && sectionOf(pendingSurface) === leafSection
				? pendingSurface
				: null;
		var ancestor = leaf.parentElement;
		while (!surface && ancestor && ancestor !== leafSection) {
			if (isVisibleSurface(ancestor)) surface = ancestor;
			ancestor = ancestor.parentElement;
		}
		return makeLadder(
			dedupeStops([leaf, surface, leafSection]),
			x,
			y,
			null,
			direct
		);
	}

	// Keyboard-activated clicks have detail === 0 and often meaningless (0, 0)
	// coordinates. Resolve their semantic target directly and never participate
	// in point-signature cycling.
	function resolveDirectTarget(target) {
		var leaf = closestStampedLeaf(target);
		if (leaf) return ladderForLeaf(leaf, null, 0, 0, true);
		var surface = closestVisibleSurface(target);
		var section = sectionOf(surface || target);
		return makeLadder(
			dedupeStops([surface, section]),
			0,
			0,
			null,
			true
		);
	}

	function resolveTarget(ev) {
		var x = typeof ev.clientX === "number" ? ev.clientX : 0;
		var y = typeof ev.clientY === "number" ? ev.clientY : 0;
		var hitStack = [ev.target];
		if (
			document.elementsFromPoint &&
			typeof ev.clientX === "number" &&
			typeof ev.clientY === "number"
		) {
			hitStack = document.elementsFromPoint(x, y);
			if (hitStack.indexOf(ev.target) < 0) hitStack.unshift(ev.target);
		}

		var leaf = null;
		var pendingSurface = null;
		var terminalSurface = null;
		for (var i = 0; i < hitStack.length; i++) {
			var hit = hitStack[i];
			var hitLeaf = closestStampedLeaf(hit);
			if (hitLeaf && containsPoint(hitLeaf, x, y)) {
				leaf = hitLeaf;
				break;
			}

			// Evaluate the actual hit-stack item. Climbing from a transparent
			// overlay to one of its wrappers here can make an unrelated ancestor
			// incorrectly terminal before a visible lower leaf is considered.
			var hitState = surfaceHitState(hit);
			if (hitState === "none" || !containsPoint(hit, x, y)) continue;
			if (hitState === "opaque") {
				terminalSurface = hit;
				break;
			}
			if (!pendingSurface) pendingSurface = hit;
		}

		if (leaf) return ladderForLeaf(leaf, pendingSurface, x, y, false);

		var deepestSurface = terminalSurface || pendingSurface;
		var section = sectionOf(deepestSurface || ev.target);
		if (!section) {
			for (var j = 0; j < hitStack.length; j++) {
				section = sectionOf(hitStack[j]);
				if (section && section.getAttribute("data-wid")) break;
			}
		}
		return makeLadder(
			dedupeStops([deepestSurface, section]),
			x,
			y,
			null,
			false
		);
	}

	function describe(el, ladder) {
		var cs = window.getComputedStyle(el);
		var isSection = isTopSection(el);
		var section = isSection ? el : sectionOf(el);
		// Full-bleed stamped img of a selected section — reported so the
		// inspector can offer image-backed background controls (V4). The img
		// this very selection was PROMOTED from wins (the click resolves
		// through resolveTarget right before describe): with two stacked
		// covering imgs the DOM-order scan would report the hidden backdrop
		// instead of the visible one the user clicked.
		var bgImg = null;
		if (isSection) {
			if (
				ladder &&
				ladder.promotedBgImg &&
				sectionOf(ladder.promotedBgImg) === el &&
				coversSection(ladder.promotedBgImg, el)
			) {
				bgImg = ladder.promotedBgImg;
			} else {
				var imgs = el.querySelectorAll("img[data-wid]");
				for (var i = 0; i < imgs.length; i++) {
					if (coversSection(imgs[i], el)) {
						bgImg = imgs[i];
						break;
					}
				}
			}
		}
		return {
			wid: el.getAttribute("data-wid"),
			sectionWid: isSection
				? el.getAttribute("data-wid")
				: section
					? section.getAttribute("data-wid")
					: null,
			tag: el.tagName.toLowerCase(),
			kind: kindOf(el),
			excerpt: normalizedVisibleText(el),
			ladder: ladder
				? ladder.stops.map(function (stop) {
						return {
							wid: stop.wid,
							kind: stop.kind,
							tag: stop.tag,
							label: stop.label
						};
					})
				: [],
			ladderIndex: ladder ? ladder.index : 0,
			text:
				EDITABLE_TEXT_TAGS.indexOf(el.tagName) >= 0
					? (el.innerText || "").trim().slice(0, 120)
					: null,
			textEditable: isEditableTextLeaf(el),
			src: el.tagName === "IMG" ? el.getAttribute("src") : null,
			inlineWidth: el.tagName === "IMG" ? el.style.width : null,
			isPlaceholderImage: el.hasAttribute("data-wandit-placeholder"),
			removable: isRemovable(el),
			placeholder:
				el.tagName === "INPUT" || el.tagName === "TEXTAREA"
					? el.getAttribute("placeholder")
					: null,
			href: el.tagName === "A" ? el.getAttribute("href") : null,
			sectionStyles: isSection
				? {
						paddingTop: cs.paddingTop,
						paddingBottom: cs.paddingBottom,
						backgroundImage: cs.backgroundImage,
						backgroundColor: cs.backgroundColor
					}
				: null,
			bgImage: bgImg
				? {
						wid: bgImg.getAttribute("data-wid"),
						src: bgImg.getAttribute("src")
					}
				: null,
			styles: {
				backgroundColor: cs.backgroundColor,
				borderRadius: cs.borderRadius,
				color: cs.color,
				direction: cs.direction,
				fontFamily: cs.fontFamily,
				fontSize: cs.fontSize,
				fontStyle: cs.fontStyle,
				fontWeight: cs.fontWeight,
				height: cs.height,
				letterSpacing: cs.letterSpacing,
				lineHeight: cs.lineHeight,
				objectFit: cs.objectFit,
				textAlign: cs.textAlign,
				width: cs.width
			}
		};
	}

	function makeBox(id) {
		var box = document.createElement("div");
		box.id = id;
		box.setAttribute("aria-hidden", "true");
		(document.body || document.documentElement).appendChild(box);
		return box;
	}

	function makeOverlay(className) {
		OVERLAY_ID += 1;
		var node = makeBox("__wandit-overlay-" + OVERLAY_ID);
		node.classList.add(className);
		return node;
	}

	function ensureBoxes() {
		if (!SELECT_BOX) {
			HOVER_BOX = makeBox("__wandit-hover-box");
			SELECT_BOX = makeBox("__wandit-select-box");
		}
	}

	function positionBox(box, el, measuredRect) {
		var rect = measuredRect || el.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			box.style.display = "none";
			return rect;
		}
		box.style.display = "block";
		box.style.left = rect.left - 4 + "px";
		box.style.top = rect.top - 4 + "px";
		box.style.width = rect.width + 8 + "px";
		box.style.height = rect.height + 8 + "px";
		return rect;
	}

	function positionPin(pin, el) {
		var rect = el.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			pin.style.display = "none";
			return;
		}
		pin.style.display = "block";
		pin.style.left = rect.left - 8 + "px";
		pin.style.top = rect.top - 8 + "px";
	}

	function selectionRectChanged(next) {
		if (!LAST_SELECTION_RECT || LAST_SELECTION_RECT.wid !== next.wid) return true;
		return (
			Math.abs(LAST_SELECTION_RECT.left - next.left) > 1 ||
			Math.abs(LAST_SELECTION_RECT.top - next.top) > 1 ||
			Math.abs(LAST_SELECTION_RECT.width - next.width) > 1 ||
			Math.abs(LAST_SELECTION_RECT.height - next.height) > 1
		);
	}

	function publishSelectionRect(el, rect) {
		if (rect.width <= 0 || rect.height <= 0) {
			clearSelectionRect();
			return;
		}
		var next = {
			wid: String(el.getAttribute("data-wid") || ""),
			left: rect.left,
			top: rect.top,
			width: rect.width,
			height: rect.height
		};
		if (
			!next.wid ||
			(!SELECTION_RECT_PENDING && !selectionRectChanged(next))
		) return;
		PENDING_SELECTION_RECT = next;
		SELECTION_RECT_PENDING = true;
		if (typeof window.requestAnimationFrame !== "function") {
			flushSelectionRect();
		}
	}

	function clearSelectionRect() {
		if (!LAST_SELECTION_RECT && !SELECTION_RECT_PENDING) return;
		PENDING_SELECTION_RECT = null;
		SELECTION_RECT_PENDING = true;
		if (typeof window.requestAnimationFrame !== "function") {
			flushSelectionRect();
		}
	}

	function flushSelectionRect() {
		if (!SELECTION_RECT_PENDING) return;
		var next = PENDING_SELECTION_RECT;
		PENDING_SELECTION_RECT = null;
		SELECTION_RECT_PENDING = false;
		if (next === null) {
			LAST_SELECTION_RECT = null;
			post("selection-rect", null);
			return;
		}
		if (!selectionRectChanged(next)) return;
		LAST_SELECTION_RECT = next;
		post("selection-rect", next);
	}

	function hasActiveBoxes() {
		return (
			!!SELECTED ||
			!!HOVERED ||
			AI_TARGETS.size > 0 ||
			COMMENT_PINS.size > 0
		);
	}

	function refreshBoxes() {
		ensureBoxes();
		if (HOVERED && HOVERED.isConnected !== false) {
			positionBox(HOVER_BOX, HOVERED);
		} else {
			HOVER_BOX.style.display = "none";
		}
		if (SELECTED && SELECTED.isConnected !== false) {
			var selectedRect = SELECTED.getBoundingClientRect();
			positionBox(SELECT_BOX, SELECTED, selectedRect);
			publishSelectionRect(SELECTED, selectedRect);
		} else {
			SELECT_BOX.style.display = "none";
			clearSelectionRect();
		}
		AI_TARGETS.forEach(function (entry, wid) {
			if (
				entry.el.isConnected === false ||
				entry.box.isConnected === false
			) {
				entry.box.remove();
				AI_TARGETS.delete(wid);
				return;
			}
			positionBox(entry.box, entry.el);
		});
		COMMENT_PINS.forEach(function (entry, wid) {
			if (
				entry.el.isConnected === false ||
				entry.pin.isConnected === false
			) {
				entry.pin.remove();
				COMMENT_PINS.delete(wid);
				return;
			}
			positionPin(entry.pin, entry.el);
		});
	}

	function tick() {
		refreshBoxes();
		flushSelectionRect();
		RAF =
			hasActiveBoxes() &&
			typeof window.requestAnimationFrame === "function"
				? window.requestAnimationFrame(tick)
				: 0;
	}

	function syncBoxes() {
		refreshBoxes();
		if (
			!RAF &&
			hasActiveBoxes() &&
			typeof window.requestAnimationFrame === "function"
		) {
			RAF = window.requestAnimationFrame(tick);
		}
	}

	function replaceCommentPins(pins) {
		if (!Array.isArray(pins) || pins.length > 10) return;
		for (var pinIndex = 0; pinIndex < pins.length; pinIndex++) {
			var candidate = pins[pinIndex];
			if (
				!candidate ||
				typeof candidate.wid !== "string" ||
				!candidate.wid ||
				typeof candidate.number !== "number" ||
				candidate.number % 1 !== 0 ||
				candidate.number < 1 ||
				candidate.number > 10
			) return;
		}

		var nextPins = new Map();
		for (var nextPinIndex = 0; nextPinIndex < pins.length; nextPinIndex++) {
			var nextPin = pins[nextPinIndex];
			var pinWid = nextPin.wid;
			var pinTarget = byWid(pinWid);
			if (!pinTarget || pinTarget.isConnected === false) continue;
			var pinEntry = nextPins.get(pinWid) || COMMENT_PINS.get(pinWid);
			if (pinEntry && pinEntry.el !== pinTarget) {
				pinEntry.pin.remove();
				pinEntry = null;
			}
			if (!pinEntry) {
				pinEntry = {
					el: pinTarget,
					pin: makeOverlay("__wandit-comment-pin")
				};
			}
			pinEntry.pin.textContent = String(nextPin.number);
			nextPins.set(pinWid, pinEntry);
		}
		COMMENT_PINS.forEach(function (entry, wid) {
			if (!nextPins.has(wid)) entry.pin.remove();
		});
		COMMENT_PINS = nextPins;
		syncBoxes();
	}

	function replaceAiTargets(wids) {
		if (!Array.isArray(wids) || wids.length > 10) return;
		for (var widIndex = 0; widIndex < wids.length; widIndex++) {
			if (typeof wids[widIndex] !== "string" || !wids[widIndex]) return;
		}

		var nextTargets = new Map();
		for (var targetIndex = 0; targetIndex < wids.length; targetIndex++) {
			var targetWid = wids[targetIndex];
			var target = byWid(targetWid);
			if (!target || target.isConnected === false || nextTargets.has(targetWid)) {
				continue;
			}
			var targetEntry = AI_TARGETS.get(targetWid);
			if (targetEntry && targetEntry.el !== target) {
				targetEntry.box.remove();
				targetEntry = null;
			}
			if (!targetEntry) {
				var targetBox = makeOverlay("__wandit-ai-box");
				targetBox.classList.add("__wandit-ai-pulse");
				targetEntry = { el: target, box: targetBox };
			}
			nextTargets.set(targetWid, targetEntry);
		}
		AI_TARGETS.forEach(function (entry, wid) {
			if (!nextTargets.has(wid)) entry.box.remove();
		});
		AI_TARGETS = nextTargets;
		syncBoxes();
	}

	function setHover(el) {
		if (HOVERED === el) return;
		HOVERED = el;
		syncBoxes();
	}

	function select(el) {
		SELECTED = el;
		syncBoxes();
	}

	function clearSelection() {
		SELECTED = null;
		ACTIVE_LADDER = null;
		setHover(null);
		syncBoxes();
	}

	function sameLadderPoint(next, current) {
		return (
			!!next &&
			!!current &&
			!next.direct &&
			!current.direct &&
			next.signature === current.signature &&
			Math.abs(next.x - current.x) <= 4 &&
			Math.abs(next.y - current.y) <= 4
		);
	}

	function previewStop(ladder, afterSelection) {
		if (!ladder || ladder.stops.length === 0) return null;
		var index = 0;
		if (sameLadderPoint(ladder, ACTIVE_LADDER)) {
			index = afterSelection
				? (ACTIVE_LADDER.index + 1) % ladder.stops.length
				: ACTIVE_LADDER.index;
		}
		var target = ladder.stops[index].el;
		return target === SELECTED ? null : target;
	}

	function refreshPointerPreview() {
		POINTER_RAF = 0;
		if (MODE === "browse" || !LAST_POINTER) {
			setHover(null);
			return;
		}
		if (
			EDITING &&
			(
				LAST_POINTER.target === EDITING ||
				(EDITING.contains && EDITING.contains(LAST_POINTER.target))
			)
		) {
			setHover(null);
			return;
		}
		var ladder = resolveTarget(LAST_POINTER);
		setHover(previewStop(ladder, true));
	}

	function endEdit() {
		if (!EDITING) return;
		var el = EDITING;
		EDITING = null;
		el.blur(); // fires the one-shot blur handler installed by beginEdit
	}

	function beginEdit(el) {
		if (SUSPENDED || EDITING === el) return;
		endEdit();
		EDITING = el;
		setHover(null);
		var before = el.innerText;
		var flattenedWids = [];
		var stampedDescendants = el.querySelectorAll("[data-wid]");
		for (var i = 0; i < stampedDescendants.length; i++) {
			var descendantWid = stampedDescendants[i].getAttribute("data-wid");
			if (descendantWid && flattenedWids.indexOf(descendantWid) < 0) {
				flattenedWids.push(descendantWid);
			}
		}
		el.setAttribute("contenteditable", "true");
		el.focus();
		function onBlur() {
			el.removeEventListener("blur", onBlur);
			el.removeAttribute("contenteditable");
			if (EDITING === el) EDITING = null;
			var after = el.innerText;
			if (after !== before) {
				// Match Cheerio's text(value): preserve the user's rendered text but
				// flatten formatting into one text node (newlines stay text, not <br>).
				el.textContent = after;
				post("text-edited", {
					wid: el.getAttribute("data-wid"),
					value: after,
					flattenedWids: flattenedWids
				});
			}
		}
		el.addEventListener("blur", onBlur);
	}

	// Mirror the mode onto the root so EDITOR_STYLE can gate the img
	// drag-suppression rules; preview-iframe-only, never persisted.
	function mirrorMode() {
		document.documentElement.setAttribute("data-wandit-mode", MODE);
	}

	// Capture phase: beat the page's own click handlers (contract §11).
	document.addEventListener(
		"click",
		function (ev) {
			if (MODE === "browse") return;
			// Preserve caret placement and native text selection: clicks inside the
			// active contenteditable never advance its ancestor ladder.
			if (
				EDITING &&
				(ev.target === EDITING || (EDITING.contains && EDITING.contains(ev.target)))
			) return;
			var ladder =
				ev.detail === 0 ? resolveDirectTarget(ev.target) : resolveTarget(ev);
			ev.preventDefault();
			ev.stopPropagation();
			if (!ladder || ladder.stops.length === 0) {
				endEdit();
				clearSelection();
				post("deselect", {});
				return;
			}
			if (sameLadderPoint(ladder, ACTIVE_LADDER)) {
				ladder.index = (ACTIVE_LADDER.index + 1) % ladder.stops.length;
			}
			ACTIVE_LADDER = ladder;
			var el = ladder.stops[ladder.index].el;
			endEdit();
			select(el);
			post("select", describe(el, ladder));
			if (MODE === "edit" && isEditableTextLeaf(el)) {
				beginEdit(el);
			}
			if (
				EDITING &&
				(ev.target === EDITING || (EDITING.contains && EDITING.contains(ev.target)))
			) {
				setHover(null);
			} else {
				setHover(previewStop(ladder, true));
			}
		},
		true
	);

	// Pointer movement is RAF-throttled. The click handler also refreshes the
	// next stop immediately, so the preview advances even if the pointer stays
	// perfectly still between repeated clicks.
	document.addEventListener(
		"pointermove",
		function (ev) {
			if (MODE === "browse") return;
			LAST_POINTER = {
				target: ev.target,
				clientX: ev.clientX,
				clientY: ev.clientY
			};
			if (typeof window.requestAnimationFrame === "function") {
				if (!POINTER_RAF) POINTER_RAF = window.requestAnimationFrame(refreshPointerPreview);
			} else {
				refreshPointerPreview();
			}
		},
		true
	);

	// Native image drag would eat the mousedown→click sequence while
	// targeting/editing — belt to the EDITOR_STYLE user-drag braces.
	document.addEventListener(
		"dragstart",
		function (ev) {
			if (MODE !== "browse") ev.preventDefault();
		},
		true
	);

	document.addEventListener(
		"pointerout",
		function (ev) {
			if (!HOVERED) return;
			if (ev.target === HOVERED || (HOVERED.contains && HOVERED.contains(ev.target))) {
				LAST_POINTER = null;
				setHover(null);
			}
		},
		true
	);

	document.addEventListener(
		"keydown",
		function (ev) {
			if (
				MODE === "select" &&
				SELECTED &&
				(ev.metaKey || ev.ctrlKey) &&
				(ev.code === "KeyK" ||
					String(ev.key || "").toLowerCase() === "k")
			) {
				ev.preventDefault();
				ev.stopPropagation();
				post("ask-ai-shortcut", {});
				return;
			}
			if (ev.key !== "Escape" || MODE === "browse") return;
			// Run before page-level bubble handlers so generated JavaScript cannot
			// swallow the editor's Escape ladder while focus is inside the iframe.
			ev.preventDefault();
			ev.stopPropagation();
			endEdit();
			post("escape", {});
		},
		true
	);

	var GOOGLE_FONT_STYLESHEET_PREFIX = "https://fonts.googleapis.com/";

	function isAllowedFontStylesheetHref(href) {
		if (
			typeof href !== "string" ||
			href.indexOf(GOOGLE_FONT_STYLESHEET_PREFIX) !== 0 ||
			/[\\u0000-\\u0020\\u007f]/.test(href)
		) return false;
		try {
			var parsed = new URL(href);
			return parsed.origin === "https://fonts.googleapis.com";
		} catch (_error) {
			return false;
		}
	}

	function validateFontStylesheetHrefs(hrefs) {
		if (typeof hrefs === "undefined") return [];
		if (!Array.isArray(hrefs)) return null;
		var unique = [];
		for (var i = 0; i < hrefs.length; i++) {
			if (!isAllowedFontStylesheetHref(hrefs[i])) return null;
			if (unique.indexOf(hrefs[i]) < 0) unique.push(hrefs[i]);
		}
		return unique;
	}

	function syncPreviewFontStylesheetLinks(hrefs) {
		var validated = validateFontStylesheetHrefs(hrefs);
		if (validated === null) return false;
		var wanted = {};
		for (var i = 0; i < validated.length; i++) wanted[validated[i]] = true;
		var tagged = document.querySelectorAll('link[data-wandit-preview-font]');
		for (var j = 0; j < tagged.length; j++) {
			var taggedHref = tagged[j].getAttribute("href");
			if (!taggedHref || !wanted[taggedHref]) tagged[j].remove();
		}
		var stylesheets = document.querySelectorAll('link[rel~="stylesheet"][href]');
		for (var k = 0; k < validated.length; k++) {
			var href = validated[k];
			// Defense in depth beside the message-shape validation above.
			if (!isAllowedFontStylesheetHref(href)) continue;
			var exists = false;
			for (var n = 0; n < stylesheets.length; n++) {
				if (stylesheets[n].getAttribute("href") === href) {
					exists = true;
					break;
				}
			}
			if (exists) continue;
			var originalLink = document.createElement("link");
			originalLink.setAttribute("rel", "stylesheet");
			originalLink.setAttribute("href", href);
			originalLink.setAttribute("data-wandit-preview-font", "1");
			(document.head || document.documentElement).appendChild(originalLink);
		}
		return true;
	}

	function applyTokens(values, fontsCss2Url, fontStylesheetHrefs) {
		if (!syncPreviewFontStylesheetLinks(fontStylesheetHrefs)) return;
		Object.keys(values).forEach(function (name) {
			document.documentElement.style.setProperty("--" + name, String(values[name]));
		});
		var link = document.getElementById("__wandit-preview-fonts");
		if (isAllowedFontStylesheetHref(fontsCss2Url)) {
			if (!link) {
				link = document.createElement("link");
				link.id = "__wandit-preview-fonts";
				link.rel = "stylesheet";
				(document.head || document.documentElement).appendChild(link);
			}
			if (link.getAttribute("href") !== fontsCss2Url) {
				link.setAttribute("href", fontsCss2Url);
			}
		} else if (link) {
			link.remove();
		}
	}

	var PLACEHOLDER_ORIGINAL_ATTRIBUTES = [
		["width", "data-wandit-orig-width"],
		["height", "data-wandit-orig-height"],
		["srcset", "data-wandit-orig-srcset"],
		["sizes", "data-wandit-orig-sizes"],
		["style", "data-wandit-orig-style"]
	];
	var PLACEHOLDER_ORIGINAL_SNAPSHOT = "data-wandit-orig-snapshot";

	function preservePlaceholderImageAttributes(img) {
		for (var i = 0; i < PLACEHOLDER_ORIGINAL_ATTRIBUTES.length; i++) {
			var attribute = PLACEHOLDER_ORIGINAL_ATTRIBUTES[i][0];
			var originalAttribute = PLACEHOLDER_ORIGINAL_ATTRIBUTES[i][1];
			var value = img.getAttribute(attribute);
			if (value === null) img.removeAttribute(originalAttribute);
			else img.setAttribute(originalAttribute, value);
		}
		img.setAttribute(PLACEHOLDER_ORIGINAL_SNAPSHOT, "1");
	}

	function restorePlaceholderImageAttributes(img) {
		if (img.getAttribute(PLACEHOLDER_ORIGINAL_SNAPSHOT) === "1") {
			for (var i = 0; i < PLACEHOLDER_ORIGINAL_ATTRIBUTES.length; i++) {
				var attribute = PLACEHOLDER_ORIGINAL_ATTRIBUTES[i][0];
				var originalAttribute = PLACEHOLDER_ORIGINAL_ATTRIBUTES[i][1];
				var value = img.getAttribute(originalAttribute);
				if (value === null) img.removeAttribute(attribute);
				else img.setAttribute(attribute, value);
			}
		} else {
			img.removeAttribute("width");
			img.removeAttribute("height");
			img.removeAttribute("srcset");
			img.removeAttribute("sizes");
			img.style.aspectRatio = "";
		}
		for (var j = 0; j < PLACEHOLDER_ORIGINAL_ATTRIBUTES.length; j++) {
			img.removeAttribute(PLACEHOLDER_ORIGINAL_ATTRIBUTES[j][1]);
		}
		img.removeAttribute(PLACEHOLDER_ORIGINAL_SNAPSHOT);
		img.removeAttribute("data-wandit-placeholder");
	}

	var BRAND_ORIGINAL_HTML = "data-wandit-orig-brand-html";
	var BRAND_ORIGINAL_SNAPSHOT = "data-wandit-orig-brand-snapshot";
	var BRAND_LOGO_MARKER = "data-wandit-brand-logo";
	var BRAND_WRAPPER_TAGS = ["A", "DIV", "FIGURE", "ARTICLE"];

	function brandScopeRole(el) {
		var current = el;
		while (current) {
			if (current.tagName === "FOOTER") return "footer";
			current = current.parentElement;
		}
		current = el;
		while (current) {
			if (current.tagName === "NAV" || current.tagName === "HEADER") return "nav";
			current = current.parentElement;
		}
		return null;
	}

	function clearBrandSnapshotAttributes(el) {
		el.removeAttribute(BRAND_ORIGINAL_HTML);
		el.removeAttribute(BRAND_ORIGINAL_SNAPSHOT);
		el.removeAttribute(BRAND_LOGO_MARKER);
	}

	function validBrandUrl(value) {
		if (typeof value !== "string" || value.length > 2048) return false;
		try {
			new URL(value);
			return true;
		} catch (_error) {
			return false;
		}
	}

	// Snapshots are later replayed before the parent can restamp the restored
	// subtree. Strip every descendant wid from the serialized HTML while
	// leaving the live, currently stamped subtree untouched.
	function snapshotBrandHtml(el) {
		var descendants = el.querySelectorAll("[data-wid]");
		var wids = [];
		for (var i = 0; i < descendants.length; i++) {
			wids.push(descendants[i].getAttribute("data-wid"));
			descendants[i].removeAttribute("data-wid");
		}
		var html = "";
		try {
			html = el.innerHTML;
		} finally {
			for (var j = 0; j < descendants.length; j++) {
				if (wids[j] !== null) descendants[j].setAttribute("data-wid", wids[j]);
			}
		}
		return html;
	}

	function setBrandLogo(el, value) {
		var role = brandScopeRole(el);
		if (
			!role ||
			!el.getAttribute("data-wid") ||
			BRAND_WRAPPER_TAGS.indexOf(el.tagName) < 0
		) return;
		if (!el.getAttribute("data-brand")) el.setAttribute("data-brand", role);

		if (value === null) {
			var originalHtml = el.getAttribute(BRAND_ORIGINAL_HTML);
			if (
				el.getAttribute(BRAND_ORIGINAL_SNAPSHOT) === "1" &&
				originalHtml !== null
			) {
				el.innerHTML = originalHtml;
				clearBrandSnapshotAttributes(el);
				return;
			}
			var currentImage =
				el.querySelector("img[data-wandit-brand-image]") ||
				el.querySelector("img");
			if (!currentImage && !el.hasAttribute(BRAND_LOGO_MARKER)) {
				clearBrandSnapshotAttributes(el);
				return;
			}
			var fallback =
				String(el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim() ||
				(currentImage
					? String(currentImage.getAttribute("alt") || "").replace(/\\s+/g, " ").trim()
					: "");
			if (!fallback) return;
			el.textContent = fallback;
			clearBrandSnapshotAttributes(el);
			return;
		}

		if (!validBrandUrl(value)) return;
		var existingBrandImage = el.querySelector("img[data-wandit-brand-image]");
		var originalText = normalizedVisibleText(el) || "";
		if (el.getAttribute(BRAND_ORIGINAL_SNAPSHOT) !== "1") {
			el.setAttribute(BRAND_ORIGINAL_HTML, snapshotBrandHtml(el));
			el.setAttribute(BRAND_ORIGINAL_SNAPSHOT, "1");
		}
		var image = existingBrandImage;
		if (!image) {
			image = document.createElement("img");
			image.setAttribute(
				"alt",
				el.getAttribute("aria-label") ? "" : originalText
			);
			image.setAttribute("data-wandit-brand-image", "1");
			image.style.display = "block";
			image.style.width = "auto";
			image.style.height = "auto";
			image.style.maxWidth = "min(12rem, 40vw)";
			image.style.maxHeight = "3rem";
			image.style.objectFit = "contain";
			image.style.objectPosition = "center";
			el.textContent = "";
			el.appendChild(image);
		}
		image.setAttribute("src", value);
		el.setAttribute(BRAND_LOGO_MARKER, "1");
	}

	window.addEventListener("message", function (ev) {
		var m = ev.data;
		// The iframe has an opaque origin, so origin checks are unavailable. Only
		// the owning parent window may drive the preview-side protocol.
		if (ev.source !== window.parent) return;
		if (!m || m.source !== "wandit-preview" || m.v !== 1 || !m.payload) return;
		if (m.type === "set-suspended") {
			if (typeof m.payload.suspended !== "boolean") return;
			SUSPENDED = m.payload.suspended;
			if (SUSPENDED) endEdit();
			return;
		}
		if (m.type === "set-mode") {
			MODE =
				m.payload.mode === "select" || m.payload.mode === "edit"
					? m.payload.mode
					: "browse";
			mirrorMode();
			if (MODE !== "edit") endEdit();
			if (MODE === "browse") {
				LAST_POINTER = null;
				clearSelection();
			}
			return;
		}
		if (m.type === "select-target") {
			if (!ACTIVE_LADDER || typeof m.payload.wid !== "string") return;
			for (var ladderIndex = 0; ladderIndex < ACTIVE_LADDER.stops.length; ladderIndex++) {
				var ladderStop = ACTIVE_LADDER.stops[ladderIndex];
				if (ladderStop.wid !== m.payload.wid) continue;
				if (EDITING && ladderStop.el !== EDITING) endEdit();
				ACTIVE_LADDER.index = ladderIndex;
				select(ladderStop.el);
				post("select", describe(ladderStop.el, ACTIVE_LADDER));
				LAST_POINTER = null;
				setHover(null);
				break;
			}
			return;
		}
		if (m.type === "apply-style") {
			if (SUSPENDED) return;
			var el = byWid(String(m.payload.wid || ""));
			if (!el) return;
			var s = m.payload.style || {};
			if (typeof s.backgroundColor === "string") el.style.backgroundColor = s.backgroundColor;
			if (typeof s.borderRadius === "string") el.style.borderRadius = s.borderRadius;
			if (typeof s.color === "string") el.style.color = s.color;
			if (typeof s.fontFamily === "string") el.style.fontFamily = s.fontFamily;
			if (typeof s.fontSize === "string") el.style.fontSize = s.fontSize;
			if (typeof s.fontStyle === "string") el.style.fontStyle = s.fontStyle;
			if (typeof s.fontWeight === "string") el.style.fontWeight = s.fontWeight;
			if (typeof s.letterSpacing === "string") el.style.letterSpacing = s.letterSpacing;
			if (typeof s.lineHeight === "string") el.style.lineHeight = s.lineHeight;
			if (typeof s.objectFit === "string") el.style.objectFit = s.objectFit;
			if (typeof s.textAlign === "string") el.style.textAlign = s.textAlign;
			if (typeof s.width === "string") el.style.width = s.width;
			return;
		}
		if (m.type === "swap-image") {
			var img = byWid(String(m.payload.wid || ""));
			if (img && img.tagName === "IMG") {
				var wasPlaceholder = img.hasAttribute("data-wandit-placeholder");
				if (wasPlaceholder) restorePlaceholderImageAttributes(img);
				img.setAttribute("src", String(m.payload.src || ""));
				if (!wasPlaceholder) {
					img.removeAttribute("srcset");
					img.removeAttribute("sizes");
				}
			}
			return;
		}
		if (m.type === "set-brand-logo") {
			var brand = byWid(String(m.payload.wid || ""));
			var brandValue = m.payload.value;
			if (brand && (brandValue === null || validBrandUrl(brandValue))) {
				setBrandLogo(brand, brandValue);
			}
			return;
		}
		if (m.type === "set-comment-pins") {
			replaceCommentPins(m.payload.pins);
			return;
		}
		if (m.type === "set-ai-targets") {
			replaceAiTargets(m.payload.wids);
			return;
		}
		if (m.type === "placeholder-image") {
			var ph = byWid(String(m.payload.wid || ""));
			if (!ph || ph.tagName !== "IMG") return;
			if (!ph.hasAttribute("data-wandit-placeholder")) {
				preservePlaceholderImageAttributes(ph);
			}
			var width = m.payload.width;
			var height = m.payload.height;
			if (typeof width === "number" && typeof height === "number") {
				ph.setAttribute("width", String(width));
				ph.setAttribute("height", String(height));
				ph.style.aspectRatio = width + " / " + height;
			}
			ph.setAttribute("src", String(m.payload.src || ""));
			ph.removeAttribute("srcset");
			ph.removeAttribute("sizes");
			ph.setAttribute("alt", "");
			ph.setAttribute("data-wandit-placeholder", "1");
			return;
		}
		if (m.type === "set-text") {
			if (SUSPENDED) return;
			var target = byWid(String(m.payload.wid || ""));
			if (target && target !== EDITING) {
				target.textContent = String(
					typeof m.payload.value === "string" ? m.payload.value : ""
				);
			}
			return;
		}
		if (m.type === "remove-element") {
			var doomed = byWid(String(m.payload.wid || ""));
			if (!doomed || !isRemovable(doomed)) return;
			// Drop dangling refs BEFORE removal so no class toggle resurrects
			// a detached node (discard restores via iframe remount).
			if (SELECTED === doomed) SELECTED = null;
			if (HOVERED === doomed) HOVERED = null;
			if (EDITING === doomed) EDITING = null;
			if (
				ACTIVE_LADDER &&
				ACTIVE_LADDER.stops.some(function (stop) { return stop.el === doomed; })
			) ACTIVE_LADDER = null;
			doomed.remove();
			syncBoxes();
			return;
		}
		if (m.type === "set-link-href") {
			var anchor = byWid(String(m.payload.wid || ""));
			if (anchor && anchor.tagName === "A") {
				anchor.setAttribute("href", String(m.payload.href || ""));
			}
			return;
		}
		if (m.type === "set-placeholder") {
			var field = byWid(String(m.payload.wid || ""));
			if (field && (field.tagName === "INPUT" || field.tagName === "TEXTAREA")) {
				field.setAttribute(
					"placeholder",
					String(typeof m.payload.value === "string" ? m.payload.value : "")
				);
			}
			return;
		}
		if (m.type === "apply-section-style") {
			var section = byWid(String(m.payload.wid || ""));
			if (!section) return;
			var patch = m.payload.style || {};
			if (typeof patch.paddingTop === "string") {
				section.style.paddingTop = patch.paddingTop;
			}
			if (typeof patch.paddingBottom === "string") {
				section.style.paddingBottom = patch.paddingBottom;
			}
			if (typeof patch.backgroundColor === "string") {
				section.style.backgroundColor = patch.backgroundColor;
			}
			if (typeof patch.backgroundImage === "string") {
				if (patch.backgroundImage === "none") {
					// Explicit inline "none" — stylesheet-rule backgrounds must
					// stay overridden, mirroring the server's inline write on save.
					section.style.backgroundImage = "none";
					section.style.backgroundSize = "";
					section.style.backgroundPosition = "";
				} else {
					section.style.backgroundImage = patch.backgroundImage;
					section.style.backgroundSize = "cover";
					section.style.backgroundPosition = "center";
				}
			}
			return;
		}
		if (m.type === "set-tokens") {
			if (
				typeof m.payload.fontsCss2Url !== "undefined" &&
				!isAllowedFontStylesheetHref(m.payload.fontsCss2Url)
			) return;
			var fontStylesheetHrefs = validateFontStylesheetHrefs(
				m.payload.fontStylesheetHrefs
			);
			if (fontStylesheetHrefs === null) return;
			applyTokens(
				m.payload.values || {},
				m.payload.fontsCss2Url,
				fontStylesheetHrefs
			);
			return;
		}
		if (m.type === "clear-selection") clearSelection();
	});

	mirrorMode();

	function announce() {
		post("ready", {});
	}
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", announce);
	} else {
		announce();
	}
})();
`.trim();
