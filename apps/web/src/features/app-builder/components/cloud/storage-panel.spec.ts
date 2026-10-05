// @vitest-environment jsdom

import {
	type InfiniteData,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type {
	CloudBucket,
	CloudObject,
	CloudObjectsResponse,
} from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import { CLOUD_UPLOAD_MAX_BYTES } from "../../lib/constants";
import { formatBytes, StoragePanel } from "./storage-panel";

const PROJECT_ID = crypto.randomUUID();

const AVATARS: CloudBucket = {
	id: "avatars",
	name: "avatars",
	public: true,
	createdAt: "2026-09-01T10:00:00.000Z",
	updatedAt: "2026-09-01T10:00:00.000Z",
};

const INVOICES: CloudBucket = {
	id: "invoices",
	name: "invoices",
	public: false,
	createdAt: "2026-09-02T10:00:00.000Z",
	updatedAt: "2026-09-02T10:00:00.000Z",
};

/** A folder at the root of `avatars`. Storage folders have no size and no URL. */
const PHOTOS: CloudObject = {
	name: "photos",
	path: "photos",
	isFolder: true,
	sizeBytes: null,
	mimeType: null,
	updatedAt: null,
	downloadUrl: null,
};

const REPORT_URL =
	"https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/sign/avatars/report.pdf?token=signed";

/** A file at the root of `avatars`, with its signed download URL. */
const REPORT: CloudObject = {
	name: "report.pdf",
	path: "report.pdf",
	isFolder: false,
	sizeBytes: 1536,
	mimeType: "application/pdf",
	updatedAt: "2026-10-01T10:00:00.000Z",
	downloadUrl: REPORT_URL,
};

/** A file inside the `photos` folder. */
const BEACH: CloudObject = {
	...REPORT,
	name: "beach.jpg",
	path: "photos/beach.jpg",
	mimeType: "image/jpeg",
	downloadUrl:
		"https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/sign/avatars/photos/beach.jpg?token=signed",
};

// The cache holds every answer and nothing is stale or retried, so the
// panel never calls the API.
function cachedClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
}

/** A cache with the two buckets and the first page of two folders of `avatars`. */
function clientWithAvatars(): QueryClient {
	const queryClient = cachedClient();
	queryClient.setQueryData(cloudKeys.buckets(PROJECT_ID), [AVATARS, INVOICES]);
	cacheFolder(queryClient, "", [PHOTOS, REPORT]);
	cacheFolder(queryClient, "photos", [BEACH]);
	return queryClient;
}

// cloudObjectsQuery is an infinite query: the cache keeps the pages and the
// cursor of each page. "0" is the cursor of the first page.
function cacheFolder(
	queryClient: QueryClient,
	prefix: string,
	items: CloudObject[],
): void {
	const data: InfiniteData<CloudObjectsResponse, string> = {
		pages: [{ items, nextCursor: null }],
		pageParams: ["0"],
	};
	queryClient.setQueryData(
		cloudKeys.objects(PROJECT_ID, AVATARS.id, prefix),
		data,
	);
}

function renderPanel(queryClient: QueryClient) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(StoragePanel, {
			projectId: PROJECT_ID,
			isActive: true,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(
				TooltipProvider,
				null,
				createElement(I18nProvider, providerProps),
			),
		),
	);
}

function openAvatars(): void {
	fireEvent.click(screen.getByRole("button", { name: "avatars" }));
}

/** The hidden file input behind the "Upload file" button. */
function fileInput(): HTMLInputElement {
	const input = document.querySelector('input[type="file"]');
	if (!(input instanceof HTMLInputElement)) {
		throw new Error("The Storage panel renders no file input.");
	}
	return input;
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("StoragePanel", () => {
	it("lists the buckets with their access", () => {
		renderPanel(clientWithAvatars());

		expect(
			within(screen.getByRole("row", { name: /avatars/ })).getByText("Public"),
		).toBeTruthy();
		expect(
			within(screen.getByRole("row", { name: /invoices/ })).getByText(
				"Private",
			),
		).toBeTruthy();
	});

	it("opens a clicked bucket at its root folder", () => {
		const queryClient = clientWithAvatars();
		renderPanel(queryClient);

		openAvatars();

		expect(screen.getByText("report.pdf")).toBeTruthy();
		expect(screen.getByRole("button", { name: "photos" })).toBeTruthy();
		expect(
			queryClient
				.getQueryCache()
				.find({
					queryKey: cloudKeys.objects(PROJECT_ID, AVATARS.id, ""),
					exact: true,
				})
				?.getObserversCount(),
		).toBe(1);
	});

	it("moves into a clicked folder and shows it in the path", () => {
		renderPanel(clientWithAvatars());
		openAvatars();

		fireEvent.click(screen.getByRole("button", { name: "photos" }));

		expect(screen.getByText("beach.jpg")).toBeTruthy();
		expect(screen.queryByText("report.pdf")).toBeNull();
		const path = screen.getByRole("navigation", { name: "Folder path" });
		expect(within(path).getByRole("button", { name: "photos" })).toBeTruthy();

		// The bucket name in the path goes back to the root folder.
		fireEvent.click(within(path).getByRole("button", { name: "avatars" }));

		expect(screen.getByText("report.pdf")).toBeTruthy();
	});

	it("links a file to its signed URL in a new tab, and a folder to nothing", () => {
		renderPanel(clientWithAvatars());
		openAvatars();

		const download = screen.getByRole("link", { name: "Download report.pdf" });
		expect(download.getAttribute("href")).toBe(REPORT_URL);
		expect(download.getAttribute("target")).toBe("_blank");
		expect(download.getAttribute("rel")).toBe("noopener noreferrer");
		expect(screen.queryByRole("link", { name: "Download photos" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Delete photos" })).toBeNull();
	});

	it("asks before a file delete, names the file, and deletes nothing yet", async () => {
		const queryClient = clientWithAvatars();
		renderPanel(queryClient);
		openAvatars();

		fireEvent.click(screen.getByRole("button", { name: "Delete report.pdf" }));

		const dialog = await screen.findByRole("alertdialog");
		expect(
			within(dialog).getByText(
				"Wandit deletes report.pdf from the storage of your app. You cannot undo it.",
			),
		).toBeTruthy();
		expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
	});

	it("refuses a file name that Storage refuses before any upload", () => {
		const queryClient = clientWithAvatars();
		const toastError = vi.spyOn(toast, "error");
		renderPanel(queryClient);
		openAvatars();
		const file = new File(["x"], "صورة.png", { type: "image/png" });

		fireEvent.change(fileInput(), { target: { files: [file] } });

		expect(toastError).toHaveBeenCalledWith(
			"Storage accepts only Latin letters (a to z), digits, spaces, and simple signs like - _ . ( ) in a file name. Rename the file and try again.",
		);
		expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
	});

	it("refuses a file larger than 50 MB before any upload", () => {
		const queryClient = clientWithAvatars();
		const toastError = vi.spyOn(toast, "error");
		renderPanel(queryClient);
		openAvatars();
		const file = new File(["x"], "video.mp4", { type: "video/mp4" });
		// A real 50 MB buffer makes the spec slow. Only the size field counts for the check.
		Object.defineProperty(file, "size", { value: CLOUD_UPLOAD_MAX_BYTES + 1 });

		fireEvent.change(fileInput(), { target: { files: [file] } });

		expect(toastError).toHaveBeenCalledWith(
			"The file is larger than 50 MB. Choose a smaller file.",
		);
		expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
	});
});

describe("formatBytes", () => {
	it.each([
		[512, "en", "512 byte"],
		[1536, "en", "1.5 kB"],
		[CLOUD_UPLOAD_MAX_BYTES, "en", "50 MB"],
		// The largest unit is the gigabyte, so 2 TB stays in gigabytes.
		[2 * 1024 ** 4, "en", "2,048 GB"],
		// French puts a narrow no-break space between the number and the unit.
		[1.5 * 1024 * 1024, "fr", "1,5 Mo"],
	] as const)("formats %d bytes in %s as %s", (bytes, locale, text) => {
		expect(formatBytes(bytes, locale)).toBe(text);
	});
});
