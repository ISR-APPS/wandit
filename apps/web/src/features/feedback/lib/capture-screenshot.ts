// DOM screenshot for the feedback widget. The screenshot is best effort:
// every failure returns null, because a lost image must never stop the user
// from sending the message.

export type FeedbackScreenshot = {
	dataUrl: string;
	width: number;
	height: number;
};

// The contract caps the data URL at 2.6 M characters. Stay below that cap so
// the rest of the JSON body still fits in the server's route body limit.
const MAX_DATA_URL_LENGTH = 2_500_000;

// Form fields can hold private data. Session replay masks them, thus the
// screenshot must not show them. The same is true for the nodes that carry a
// PostHog mask marker. Dialog overlays are dropped too: the capture runs
// while the feedback dialog is open, and the dim layer would darken the
// whole image.
const MASKED_SELECTOR =
	'input, textarea, select, .ph-no-capture, [data-ph-no-capture], [data-slot="dialog-overlay"]';

// The widget draws itself over the page. Remove it from the image so the
// report shows only what the user saw. Masked nodes are removed too: the
// html-to-image filter can only remove a node, it cannot replace its value.
// The image thus shows an empty area at these positions. The live DOM does
// not change, because the filter applies to the clone.
function isCapturableNode(node: Node): boolean {
	if (!(node instanceof Element)) {
		return true;
	}

	if (node.closest("[data-feedback-widget]")) {
		return false;
	}

	return !node.matches(MASKED_SELECTOR);
}

export async function captureScreenshot(): Promise<FeedbackScreenshot | null> {
	try {
		// html-to-image is large and is only necessary when the user opens the
		// widget. Load it on demand.
		const { toJpeg } = await import("html-to-image");
		// No cacheBust: it re-downloads every image on the page and made the
		// capture take seconds. Cached images are correct for a screenshot.
		let dataUrl = await toJpeg(document.documentElement, {
			quality: 0.8,
			pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
			filter: isCapturableNode,
		});

		if (dataUrl.length > MAX_DATA_URL_LENGTH) {
			dataUrl = await toJpeg(document.documentElement, {
				quality: 0.6,
				pixelRatio: 1,
				filter: isCapturableNode,
			});
		}

		if (dataUrl.length > MAX_DATA_URL_LENGTH) {
			return null;
		}

		return {
			dataUrl,
			width: window.innerWidth,
			height: window.innerHeight,
		};
	} catch {
		return null;
	}
}
