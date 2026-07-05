import { useLocalSearchParams } from "expo-router";

import { ChatScreen } from "@/features/workspace/screens/chat-screen";

export default function ChatRoute() {
	const { projectId } = useLocalSearchParams<{ projectId: string }>();

	// Key by project so switching projects from the drawer resets chat state.
	return <ChatScreen key={projectId} />;
}
