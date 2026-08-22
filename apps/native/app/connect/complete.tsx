import { Redirect } from "expo-router";

/**
 * Landing route for the MCP OAuth deep link (…/connect/complete?mcp_code=…).
 *
 * On iOS the in-app auth session intercepts the redirect before it becomes a
 * navigation, so this screen normally never shows. It exists for the paths
 * where the ROUTER receives the link anyway — Android's browser handoff, or a
 * cold start after the process died mid-auth — so the user lands home instead
 * of on +not-found. The in-flight connect mutation (connectors.mutations.ts)
 * still owns the actual completion; a cold start simply means reconnecting
 * from the Connect apps sheet.
 */
export default function ConnectCompleteRoute() {
	return <Redirect href="/" />;
}
