import { describe, expect, it } from "vitest";

import { snapshotCheckpointProgress } from "./checkpoint-progress";

describe("snapshotCheckpointProgress", () => {
	it("reads the defaults from a null snapshot", () => {
		expect(snapshotCheckpointProgress(null)).toEqual({
			checkpointDebits: [],
			checkpoints: 0,
		});
	});

	it("reads the values of a valid snapshot", () => {
		expect(
			snapshotCheckpointProgress({
				checkpointDebits: [400, 500],
				checkpoints: 2,
			}),
		).toEqual({ checkpointDebits: [400, 500], checkpoints: 2 });
	});

	it("reads 0 checkpoints and keeps the debits when checkpoints is bad", () => {
		expect(
			snapshotCheckpointProgress({
				checkpointDebits: [400],
				checkpoints: "many",
			}),
		).toEqual({ checkpointDebits: [400], checkpoints: 0 });
	});

	it("throws when checkpointDebits holds a non-number entry", () => {
		expect(() =>
			snapshotCheckpointProgress({
				checkpointDebits: ["oops"],
				checkpoints: 1,
			}),
		).toThrow("AI usage event snapshot has a corrupt checkpointDebits entry");
	});

	it("throws when checkpointDebits holds a negative entry", () => {
		expect(() =>
			snapshotCheckpointProgress({
				checkpointDebits: [-1],
				checkpoints: 1,
			}),
		).toThrow("AI usage event snapshot has a corrupt checkpointDebits entry");
	});
});
