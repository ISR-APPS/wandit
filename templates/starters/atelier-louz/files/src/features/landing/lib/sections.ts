// The section anchors of the home page, in scroll order.
// SiteHeader shows them as links on desktop, and MobileMenu shows them in its sheet.

/** One anchor: the `id` of a section and the message key of its link text. */
export const SECTION_LINKS = [
	{ href: "#materials", key: "nav.materials" },
	{ href: "#projects", key: "nav.projects" },
	{ href: "#method", key: "nav.method" },
	{ href: "#contact", key: "nav.contact" },
] as const;
