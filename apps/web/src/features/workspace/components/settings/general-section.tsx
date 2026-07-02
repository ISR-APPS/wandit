// Settings → General card: rename the project and manage Meta/TikTok ad
// pixel IDs. Local input state resyncs from the store; the name saves through
// the projects mutation, pixels through the workspace mock services.

import { Button } from "@my-better-t-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { Separator } from "@my-better-t-app/ui/components/separator";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PROJECT_NAME_MAX_LENGTH, useRenameProject } from "@/features/projects";
import { WORKSPACE_COPY } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

const COPY = WORKSPACE_COPY.settings;

export function GeneralSection() {
	const { project, projectId, state, updatePixels } = useWorkspace();
	const rename = useRenameProject();

	const [name, setName] = useState(project?.name ?? "");
	useEffect(() => {
		setName(project?.name ?? "");
	}, [project?.name]);

	const savedMeta = state?.pixels.metaPixelId ?? null;
	const savedTiktok = state?.pixels.tiktokPixelId ?? null;
	const [metaValue, setMetaValue] = useState(savedMeta ?? "");
	const [tiktokValue, setTiktokValue] = useState(savedTiktok ?? "");
	useEffect(() => {
		setMetaValue(savedMeta ?? "");
		setTiktokValue(savedTiktok ?? "");
	}, [savedMeta, savedTiktok]);

	const trimmedName = name.trim();
	const nameDisabled =
		!trimmedName || trimmedName === project?.name || rename.isPending;

	const pixelsUnchanged =
		(metaValue.trim() || null) === savedMeta &&
		(tiktokValue.trim() || null) === savedTiktok;

	const handleNameSave = () => {
		if (nameDisabled) return;
		rename.mutate(
			{ id: projectId, name: trimmedName },
			{ onSuccess: () => toast.success(COPY.nameSaved) },
		);
	};

	const handlePixelsSave = () => {
		updatePixels({
			metaPixelId: metaValue.trim() || null,
			tiktokPixelId: tiktokValue.trim() || null,
		});
		toast.success(COPY.pixelsSaved);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-display">{COPY.generalTitle}</CardTitle>
				<CardDescription>{COPY.generalDescription}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<div className="space-y-2">
					<Label htmlFor="settings-project-name">{COPY.nameLabel}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="settings-project-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={PROJECT_NAME_MAX_LENGTH}
						/>
						<Button size="sm" onClick={handleNameSave} disabled={nameDisabled}>
							{rename.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{COPY.nameSave}
						</Button>
					</div>
				</div>

				<Separator />

				<div className="flex flex-col gap-4">
					<div>
						<h3 className="font-medium text-sm">{COPY.pixelsTitle}</h3>
						<p className="mt-1 text-muted-foreground text-xs">
							{COPY.pixelsDescription}
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="settings-meta-pixel">{COPY.metaPixelLabel}</Label>
						<Input
							id="settings-meta-pixel"
							className="font-mono"
							placeholder={COPY.pixelPlaceholder}
							value={metaValue}
							onChange={(e) => setMetaValue(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="settings-tiktok-pixel">
							{COPY.tiktokPixelLabel}
						</Label>
						<Input
							id="settings-tiktok-pixel"
							className="font-mono"
							placeholder={COPY.pixelPlaceholder}
							value={tiktokValue}
							onChange={(e) => setTiktokValue(e.target.value)}
						/>
					</div>
					<div>
						<Button
							size="sm"
							variant="secondary"
							onClick={handlePixelsSave}
							disabled={pixelsUnchanged}
						>
							{COPY.pixelsSave}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
