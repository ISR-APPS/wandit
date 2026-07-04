// Settings → General card: rename the project and manage Meta/TikTok ad
// pixel IDs. Local input state resyncs from the store; the name saves through
// the projects mutation, pixels through the workspace mock services.

import { Button } from "@wandit/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wandit/ui/components/card";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Separator } from "@wandit/ui/components/separator";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PROJECT_NAME_MAX_LENGTH, useRenameProject } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import { useWorkspace } from "../../lib/store";

export function GeneralSection() {
	const { t } = useTranslation();
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
			{ onSuccess: () => toast.success(t("settings.nameSaved")) },
		);
	};

	const handlePixelsSave = () => {
		updatePixels({
			metaPixelId: metaValue.trim() || null,
			tiktokPixelId: tiktokValue.trim() || null,
		});
		toast.success(t("settings.pixelsSaved"));
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-display">
					{t("settings.generalTitle")}
				</CardTitle>
				<CardDescription>{t("settings.generalDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<div className="space-y-2">
					<Label htmlFor="settings-project-name">
						{t("settings.nameLabel")}
					</Label>
					<div className="flex items-center gap-2">
						<Input
							id="settings-project-name"
							dir="auto"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={PROJECT_NAME_MAX_LENGTH}
							disabled={rename.isPending}
						/>
						<Button size="sm" onClick={handleNameSave} disabled={nameDisabled}>
							{rename.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{t("settings.nameSave")}
						</Button>
					</div>
				</div>

				<Separator />

				<div className="flex flex-col gap-4">
					<div>
						<h3 className="font-medium text-sm">{t("settings.pixelsTitle")}</h3>
						<p className="mt-1 text-muted-foreground text-xs">
							{t("settings.pixelsDescription")}
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="settings-meta-pixel">
							{t("settings.metaPixelLabel")}
						</Label>
						<Input
							id="settings-meta-pixel"
							className="font-mono"
							placeholder={t("settings.pixelPlaceholder")}
							value={metaValue}
							onChange={(e) => setMetaValue(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="settings-tiktok-pixel">
							{t("settings.tiktokPixelLabel")}
						</Label>
						<Input
							id="settings-tiktok-pixel"
							className="font-mono"
							placeholder={t("settings.pixelPlaceholder")}
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
							{t("settings.pixelsSave")}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
