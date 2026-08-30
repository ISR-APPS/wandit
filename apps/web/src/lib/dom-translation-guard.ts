/**
 * Chrome, Edge and the Google app translate a page in place: the translator
 * replaces every text node with `<font>` wrappers. React keeps references to
 * the original nodes, so its next commit calls `insertBefore` or `removeChild`
 * with a node that is no longer a child of the parent. The DOM throws
 * `NotFoundError`, React aborts the commit, and the user lands on the error
 * screen (facebook/react#11538, Sentry WANDIT-WEB-V / WANDIT-WEB-1E).
 *
 * This guard makes those two calls tolerant. It changes nothing on the happy
 * path: when the arguments are valid, the native method runs unchanged. Only
 * a call that would throw `NotFoundError` is redirected:
 * - `removeChild` of a node that is not our child is skipped.
 * - `insertBefore` a reference that is not our child inserts before the
 *   reference's wrapper when that wrapper is our child, else appends.
 *
 * Install once, before the first React render.
 */

const GUARD_FLAG = "__wanditDomTranslationGuard";

type GuardedPrototype = Node & { [GUARD_FLAG]?: true };

export function installDomTranslationGuard(): void {
	if (typeof Node === "undefined" || !Node.prototype) {
		return;
	}

	const prototype = Node.prototype as GuardedPrototype;
	if (prototype[GUARD_FLAG]) {
		return;
	}

	const nativeRemoveChild = prototype.removeChild;
	const nativeInsertBefore = prototype.insertBefore;

	prototype.removeChild = function removeChild<T extends Node>(
		this: Node,
		child: T,
	): T {
		if (child.parentNode !== this) {
			return child;
		}
		return nativeRemoveChild.call(this, child) as T;
	};

	prototype.insertBefore = function insertBefore<T extends Node>(
		this: Node,
		node: T,
		reference: Node | null,
	): T {
		if (reference && reference.parentNode !== this) {
			const anchor = findChildAncestor(this, reference);
			return nativeInsertBefore.call(this, node, anchor) as T;
		}
		return nativeInsertBefore.call(this, node, reference) as T;
	};

	Object.defineProperty(prototype, GUARD_FLAG, {
		value: true,
		configurable: true,
	});
}

/**
 * The ancestor of `node` that is a direct child of `parent`, or null when
 * `node` is not inside `parent` at all (detached by the translator).
 */
function findChildAncestor(parent: Node, node: Node): Node | null {
	let current = node.parentNode;
	while (current) {
		if (current.parentNode === parent) {
			return current;
		}
		current = current.parentNode;
	}
	return null;
}
