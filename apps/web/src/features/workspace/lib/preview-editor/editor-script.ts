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
.__wandit-hover { outline: 2px dashed #f97316 !important; outline-offset: 2px !important; }
.__wandit-selected { outline: 2px solid #f97316 !important; outline-offset: 2px !important; }
[contenteditable="true"][data-wid] { cursor: text; }
:root[data-wandit-mode="select"] img, :root[data-wandit-mode="edit"] img { -webkit-user-drag: none; user-drag: none; }
`.trim();

export const EDITOR_SCRIPT = `
(function () {
	"use strict";
	var MODE = "browse";
	var SELECTED = null;
	var HOVERED = null;
	var EDITING = null;

	function post(type, payload) {
		try {
			window.parent.postMessage(
				{ source: "wandit-preview", v: 1, type: type, payload: payload || {} },
				"*"
			);
		} catch (e) {
			/* parent gone — nothing to do */
		}
	}

	function stamped(target) {
		return target && target.closest ? target.closest("[data-wid]") : null;
	}

	function byWid(wid) {
		var escaped =
			window.CSS && CSS.escape ? CSS.escape(wid) : wid.replace(/["\\\\]/g, "");
		return document.querySelector('[data-wid="' + escaped + '"]');
	}

	var SECTION_TAGS = ["HEADER", "SECTION", "FOOTER", "ASIDE", "NAV"];

	// Structural mirror of the server's TOP_LEVEL_SECTION_SELECTOR (stamp.ts):
	// a section-ish tag whose parent is <body> or body > <main>. Ancestry
	// alone is NOT enough — a floating leaf directly under <body> (WhatsApp
	// CTA, badge img) is its own outermost stamped ancestor, and calling it a
	// section would offer padding/background controls whose section-style op
	// the server rejects, 422-ing the user's whole save batch.
	function isTopSection(el) {
		if (!el.tagName || SECTION_TAGS.indexOf(el.tagName) < 0) return false;
		var parent = el.parentElement;
		if (!parent) return false;
		if (parent.tagName === "BODY") return true;
		return (
			parent.tagName === "MAIN" &&
			!!parent.parentElement &&
			parent.parentElement.tagName === "BODY"
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

	// A stamped IMG covering >= 90% of BOTH axes of its top-level section is
	// that section's de-facto BACKGROUND — hover/click should land on the
	// section, and its controls own the image (V4 full-bleed rule).
	function coversSection(img, section) {
		var ir = img.getBoundingClientRect();
		var sr = section.getBoundingClientRect();
		if (sr.width <= 0 || sr.height <= 0) return false;
		return ir.width >= sr.width * 0.9 && ir.height >= sr.height * 0.9;
	}

	// The img the LAST resolveTarget call promoted into its section (null
	// when the last resolution promoted nothing). describe() prefers it over
	// the DOM-order scan so stacked full-bleed layers (blurred backdrop copy
	// below, sharp copy on top) report the img the user actually clicked.
	var PROMOTED_BG_IMG = null;

	// Full-bleed stamped IMG → its stamped top-level section; anything else
	// unchanged (smaller inline images keep selecting as themselves).
	function promoteBackgroundImg(el) {
		PROMOTED_BG_IMG = null;
		if (!el || el.tagName !== "IMG") return el;
		var section = sectionOf(el);
		if (!section || !section.getAttribute("data-wid")) return el;
		if (!coversSection(el, section)) return el;
		PROMOTED_BG_IMG = el;
		return section;
	}

	var TEXT_TAGS = ["H1", "H2", "H3", "H4", "H5", "H6", "P", "LI", "BLOCKQUOTE", "FIGCAPTION", "A", "BUTTON"];

	// Clicks/hovers often land on an unstamped scrim ABOVE the real target
	// (builder pages overlay images with tint divs). Direct stamped-LEAF hits
	// keep the fast path; when the direct hit is nothing or a whole section,
	// walk the full hit-test stack topmost-first and pick the first stamped
	// non-section element that geometrically contains the point — so covered
	// images/links/headings stay selectable. Falls back to the direct result.
	// Every return path runs through promoteBackgroundImg so a full-bleed
	// background img resolves to its SECTION for hover AND click alike.
	function resolveTarget(ev) {
		var direct = stamped(ev.target);
		if (direct && !isTopSection(direct)) return promoteBackgroundImg(direct);
		if (
			document.elementsFromPoint &&
			typeof ev.clientX === "number" &&
			typeof ev.clientY === "number"
		) {
			var stack = document.elementsFromPoint(ev.clientX, ev.clientY);
			for (var i = 0; i < stack.length; i++) {
				var candidate = stack[i];
				if (!candidate.hasAttribute || !candidate.hasAttribute("data-wid")) continue;
				if (isTopSection(candidate)) continue;
				var rect = candidate.getBoundingClientRect();
				if (
					ev.clientX >= rect.left &&
					ev.clientX <= rect.right &&
					ev.clientY >= rect.top &&
					ev.clientY <= rect.bottom
				) {
					return promoteBackgroundImg(candidate);
				}
			}
		}
		return promoteBackgroundImg(direct);
	}

	function describe(el) {
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
				PROMOTED_BG_IMG &&
				sectionOf(PROMOTED_BG_IMG) === el &&
				coversSection(PROMOTED_BG_IMG, el)
			) {
				bgImg = PROMOTED_BG_IMG;
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
			kind: isSection ? "section" : "element",
			text:
				TEXT_TAGS.indexOf(el.tagName) >= 0
					? (el.innerText || "").trim().slice(0, 120)
					: null,
			src: el.tagName === "IMG" ? el.getAttribute("src") : null,
			href: el.tagName === "A" ? el.getAttribute("href") : null,
			sectionStyles: isSection
				? {
						paddingTop: cs.paddingTop,
						paddingBottom: cs.paddingBottom,
						backgroundImage: cs.backgroundImage
					}
				: null,
			bgImage: bgImg
				? {
						wid: bgImg.getAttribute("data-wid"),
						src: bgImg.getAttribute("src")
					}
				: null,
			styles: {
				color: cs.color,
				fontSize: cs.fontSize,
				fontFamily: cs.fontFamily
			}
		};
	}

	function setHover(el) {
		if (HOVERED === el) return;
		if (HOVERED) HOVERED.classList.remove("__wandit-hover");
		HOVERED = el;
		if (HOVERED) HOVERED.classList.add("__wandit-hover");
	}

	function select(el) {
		if (SELECTED && SELECTED !== el) SELECTED.classList.remove("__wandit-selected");
		SELECTED = el;
		el.classList.add("__wandit-selected");
		setHover(null);
	}

	function clearSelection() {
		if (SELECTED) SELECTED.classList.remove("__wandit-selected");
		SELECTED = null;
		setHover(null);
	}

	function endEdit() {
		if (!EDITING) return;
		var el = EDITING;
		EDITING = null;
		el.blur(); // fires the one-shot blur handler installed by beginEdit
	}

	function beginEdit(el) {
		if (EDITING === el) return;
		endEdit();
		EDITING = el;
		var before = el.innerText;
		el.setAttribute("contenteditable", "true");
		el.focus();
		function onBlur() {
			el.removeEventListener("blur", onBlur);
			el.removeAttribute("contenteditable");
			if (EDITING === el) EDITING = null;
			var after = el.innerText;
			if (after !== before) {
				post("text-edited", { wid: el.getAttribute("data-wid"), value: after });
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
			var el = resolveTarget(ev);
			if (EDITING && el === EDITING) return; // clicks inside the edited text
			ev.preventDefault();
			ev.stopPropagation();
			if (!el) {
				endEdit();
				clearSelection();
				post("deselect", {});
				return;
			}
			endEdit();
			select(el);
			post("select", describe(el));
			if (MODE === "edit" && el.tagName !== "IMG" && TEXT_TAGS.indexOf(el.tagName) >= 0) {
				beginEdit(el);
			}
		},
		true
	);

	// Same resolution as click so the outline previews EXACTLY what a click
	// would select (including the elementsFromPoint fallback under scrims).
	document.addEventListener(
		"mouseover",
		function (ev) {
			if (MODE === "browse") return;
			var el = resolveTarget(ev);
			setHover(el && el !== SELECTED ? el : null);
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
		"mouseout",
		function (ev) {
			if (!HOVERED) return;
			if (ev.target === HOVERED || (HOVERED.contains && HOVERED.contains(ev.target))) {
				setHover(null);
			}
		},
		true
	);

	document.addEventListener("keydown", function (ev) {
		if (ev.key !== "Escape" || MODE === "browse") return;
		endEdit();
		clearSelection();
		post("deselect", {});
	});

	function applyTokens(values, fontsCss2Url) {
		Object.keys(values).forEach(function (name) {
			document.documentElement.style.setProperty("--" + name, String(values[name]));
		});
		if (typeof fontsCss2Url === "string" && fontsCss2Url) {
			var link = document.getElementById("__wandit-preview-fonts");
			if (!link) {
				link = document.createElement("link");
				link.id = "__wandit-preview-fonts";
				link.rel = "stylesheet";
				(document.head || document.documentElement).appendChild(link);
			}
			if (link.getAttribute("href") !== fontsCss2Url) {
				link.setAttribute("href", fontsCss2Url);
			}
		}
	}

	window.addEventListener("message", function (ev) {
		var m = ev.data;
		if (!m || m.source !== "wandit-preview" || m.v !== 1 || !m.payload) return;
		if (m.type === "set-mode") {
			MODE =
				m.payload.mode === "select" || m.payload.mode === "edit"
					? m.payload.mode
					: "browse";
			mirrorMode();
			if (MODE !== "edit") endEdit();
			if (MODE === "browse") clearSelection();
			return;
		}
		if (m.type === "apply-style") {
			var el = byWid(String(m.payload.wid || ""));
			if (!el) return;
			var s = m.payload.style || {};
			if (typeof s.color === "string") el.style.color = s.color;
			if (typeof s.fontSize === "string") el.style.fontSize = s.fontSize;
			if (typeof s.fontFamily === "string") el.style.fontFamily = s.fontFamily;
			return;
		}
		if (m.type === "swap-image") {
			var img = byWid(String(m.payload.wid || ""));
			if (img && img.tagName === "IMG") {
				img.setAttribute("src", String(m.payload.src || ""));
				img.removeAttribute("srcset");
				img.removeAttribute("sizes");
			}
			return;
		}
		if (m.type === "set-text") {
			var target = byWid(String(m.payload.wid || ""));
			if (target && target !== EDITING) {
				target.innerText = String(
					typeof m.payload.value === "string" ? m.payload.value : ""
				);
			}
			return;
		}
		if (m.type === "remove-element") {
			var doomed = byWid(String(m.payload.wid || ""));
			if (!doomed) return;
			// Drop dangling refs BEFORE removal so no class toggle resurrects
			// a detached node (discard restores via iframe remount).
			if (SELECTED === doomed) SELECTED = null;
			if (HOVERED === doomed) HOVERED = null;
			if (EDITING === doomed) EDITING = null;
			doomed.remove();
			return;
		}
		if (m.type === "set-link-href") {
			var anchor = byWid(String(m.payload.wid || ""));
			if (anchor && anchor.tagName === "A") {
				anchor.setAttribute("href", String(m.payload.href || ""));
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
			applyTokens(m.payload.values || {}, m.payload.fontsCss2Url);
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
