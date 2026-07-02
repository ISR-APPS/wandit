import { Loader2 } from "lucide-react";

export default function Loader() {
	return (
		<div className="flex h-full min-h-40 items-center justify-center">
			<Loader2 className="size-5 animate-spin text-muted-foreground" />
		</div>
	);
}
