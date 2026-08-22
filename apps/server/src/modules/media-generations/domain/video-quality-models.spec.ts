import { describe, expect, it } from "vitest";

import {
	resolveVideoGenerationPlan,
	VIDEO_EDIT_ENGINE_MODEL,
	VIDEO_QUALITY_CAPABILITIES,
	VIDEO_QUALITY_MODELS,
	videoQualities,
} from "./video-quality-models";

describe("video quality descriptors", () => {
	it("maps every tier and generation kind to its Kling renderer", () => {
		expect(VIDEO_QUALITY_MODELS).toEqual({
			standard: {
				i2v: "klingai/kling-v2.6-i2v",
				t2v: "klingai/kling-v2.6-t2v",
			},
			max: {
				i2v: "klingai/kling-v3.0-i2v",
				t2v: "klingai/kling-v3.0-t2v",
			},
		});
	});

	it("declares the capability ceiling for every tier", () => {
		expect(VIDEO_QUALITY_CAPABILITIES).toEqual({
			standard: {
				maxDurationSeconds: 10,
				multiShot: false,
				narration: false,
				talking: false,
			},
			max: {
				maxDurationSeconds: 15,
				multiShot: true,
				narration: true,
				talking: true,
			},
		});
	});
});

describe("resolveVideoGenerationPlan", () => {
	it.each([
		{
			kind: "t2v",
			modelId: "klingai/kling-v2.6-t2v",
			quality: "standard",
		},
		{
			kind: "i2v",
			modelId: "klingai/kling-v2.6-i2v",
			quality: "standard",
		},
		{
			kind: "t2v",
			modelId: "klingai/kling-v3.0-t2v",
			quality: "max",
		},
		{
			kind: "i2v",
			modelId: "klingai/kling-v3.0-i2v",
			quality: "max",
		},
	] as const)("uses $modelId for a $quality $kind request within its tier caps", ({
		kind,
		modelId,
		quality,
	}) => {
		expect(
			resolveVideoGenerationPlan({
				durationSeconds: quality === "max" ? 15 : 10,
				kind,
				multiShot: quality === "max",
				narration: quality === "max",
				quality,
				talking: quality === "max",
			}),
		).toEqual({
			autoUpgraded: false,
			modelId,
			quality,
			upgradeReasons: [],
		});
	});

	it.each([
		{
			durationSeconds: 10,
			multiShot: false,
			narration: false,
			reason: "talking-person",
			talking: true,
		},
		{
			durationSeconds: 10,
			multiShot: false,
			narration: true,
			reason: "narration",
			talking: false,
		},
		{
			durationSeconds: 10,
			multiShot: true,
			narration: false,
			reason: "multi-shot",
			talking: false,
		},
		{
			durationSeconds: 15,
			multiShot: false,
			narration: false,
			reason: "duration",
			talking: false,
		},
	] as const)("auto-upgrades standard for $reason alone", ({
		durationSeconds,
		multiShot,
		narration,
		reason,
		talking,
	}) => {
		expect(
			resolveVideoGenerationPlan({
				durationSeconds,
				kind: "t2v",
				multiShot,
				narration,
				quality: "standard",
				talking,
			}),
		).toEqual({
			autoUpgraded: true,
			modelId: "klingai/kling-v3.0-t2v",
			quality: "max",
			upgradeReasons: [reason],
		});
	});

	it.each([
		{
			durationSeconds: 10,
			multiShot: true,
			narration: false,
			reasons: ["talking-person", "multi-shot"],
			talking: true,
		},
		{
			durationSeconds: 15,
			multiShot: false,
			narration: false,
			reasons: ["talking-person", "duration"],
			talking: true,
		},
		{
			durationSeconds: 15,
			multiShot: true,
			narration: false,
			reasons: ["multi-shot", "duration"],
			talking: false,
		},
		{
			durationSeconds: 15,
			multiShot: true,
			narration: false,
			reasons: ["talking-person", "multi-shot", "duration"],
			talking: true,
		},
		{
			durationSeconds: 15,
			multiShot: true,
			narration: true,
			reasons: ["talking-person", "narration", "multi-shot", "duration"],
			talking: true,
		},
	] as const)("records every reason when capabilities combine as $reasons", ({
		durationSeconds,
		multiShot,
		narration,
		reasons,
		talking,
	}) => {
		expect(
			resolveVideoGenerationPlan({
				durationSeconds,
				kind: "i2v",
				multiShot,
				narration,
				quality: "standard",
				talking,
			}),
		).toEqual({
			autoUpgraded: true,
			modelId: "klingai/kling-v3.0-i2v",
			quality: "max",
			upgradeReasons: reasons,
		});
	});

	it("never selects the edit engine for a tier resolution", () => {
		for (const quality of videoQualities) {
			for (const kind of ["t2v", "i2v"] as const) {
				for (const durationSeconds of [5, 10, 15] as const) {
					for (const talking of [false, true]) {
						for (const multiShot of [false, true]) {
							expect(
								resolveVideoGenerationPlan({
									durationSeconds,
									kind,
									multiShot,
									narration: false,
									quality,
									talking,
								}).modelId,
							).not.toBe(VIDEO_EDIT_ENGINE_MODEL);
						}
					}
				}
			}
		}
	});
});
