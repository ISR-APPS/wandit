/**
 * Wandit fork of the Claude Code bridge turn driver (`runTurn`), based on
 * `@ai-sdk/harness-claude-code` 1.0.137. `claude-code-bridge-fork.ts` splices
 * this text into the vendor bridge bundle in place of the vendor `runTurn`,
 * and the bundle runs inside the sandbox. The vendor driver starts one Claude
 * Code `query()` per turn and closes it at the turn end. This driver keeps the
 * query open between turns and sends each new prompt through the streaming
 * input, so a warm turn skips the CLI start. It calls the vendor helpers of
 * the bundle (`claudeSdk`, `createEmitStreamEvent`, ...) by their bundle names.
 */

/**
 * The open query of this bridge process: the CLI process, its input queue,
 * and the turn it streams to now. Empty before the first turn and after a
 * close. `var`, like the vendor state: the bundle awaits `runBridge` at the
 * top level, above this line, and a `let` would not exist yet then.
 */
var liveQuery;

// biome-ignore lint/correctness/noUnusedVariables: the vendor bundle calls it after the splice.
async function runTurn(start, turn) {
	const key = queryKeyOf(start);
	// A changed tool list, model, instruction, or env needs a new CLI process:
	// the vendor SDK fixes them when the query starts.
	if (liveQuery != null && (liveQuery.closed || liveQuery.key !== key)) {
		closeQuery(liveQuery);
	}
	if (liveQuery == null) {
		liveQuery = openQuery(start, key, turn.firstTurn);
	} else {
		liveQuery.input.push(userMessageOf(start.prompt));
	}
	await driveTurn(liveQuery, start, turn);
}

/** The options a running query cannot change, as one comparable string. */
function queryKeyOf(start) {
	return JSON.stringify({
		builtinToolFiltering: start.builtinToolFiltering ?? null,
		effort: start.effort ?? null,
		env: start.env ?? null,
		instructions: start.instructions ?? null,
		maxTurns: start.maxTurns ?? null,
		mcpServers: start.mcpServers ?? null,
		model: start.model ?? null,
		permissionMode: start.permissionMode ?? null,
		responseFormat: start.responseFormat ?? null,
		skills: start.skills ?? null,
		thinking: start.thinking ?? null,
		tools: start.tools ?? null,
	});
}

/** One user message in the shape of the vendor streaming input. */
function userMessageOf(text) {
	return {
		message: { content: [{ text, type: "text" }], role: "user" },
		parent_tool_use_id: null,
		type: "user",
		uuid: randomUUID3(),
	};
}

/** An async queue of user messages; the query reads it until `close`. */
function createInputQueue() {
	const pending = [];
	const waiters = [];
	let closed = false;
	return {
		close() {
			closed = true;
			while (waiters.length > 0) {
				waiters.shift()({ done: true, value: undefined });
			}
		},
		iterable: {
			[Symbol.asyncIterator]() {
				return {
					next() {
						if (pending.length > 0) {
							return Promise.resolve({ done: false, value: pending.shift() });
						}
						if (closed) {
							return Promise.resolve({ done: true, value: undefined });
						}
						return new Promise((resolve) => waiters.push(resolve));
					},
				};
			},
		},
		push(message) {
			if (closed) {
				return;
			}
			const waiter = waiters.shift();
			if (waiter === undefined) {
				pending.push(message);
			} else {
				waiter({ done: false, value: message });
			}
		},
	};
}

/**
 * Starts the CLI query with the first prompt. The tool handlers, the
 * permission hooks, and the compaction latch reach the current turn through
 * `query.turn`, because one query serves many turns.
 */
function openQuery(start, key, firstTurn) {
	const input = createInputQueue();
	input.push(userMessageOf(start.prompt));
	const query = {
		abort: new AbortController(),
		closed: false,
		input,
		iterator: null,
		key,
		state: createClaudeStreamEventState(),
		turn: null,
	};
	const emit = (event) => query.turn?.emit(event);
	const currentTurn = {
		requestToolApproval: (approvalId) =>
			query.turn.requestToolApproval(approvalId),
		requestToolResult: (request) => query.turn.requestToolResult(request),
	};
	const toolCallNames = {
		set: (id, name) => query.state.nativeToolCallNames.set(id, name),
	};
	const approvalIds = {
		add: (id) => query.state.approvalRequestedToolUseIds.add(id),
	};
	const mcpServers = { ...start.mcpServers };
	if (start.tools && start.tools.length > 0) {
		const server = new mcpModule.McpServer({
			name: "harness-tools",
			version: "1.0.0",
		});
		for (const tool of start.tools) {
			server.registerTool(
				tool.name,
				{
					description: tool.description ?? "",
					inputSchema: jsonSchemaToZodObject(tool.inputSchema),
				},
				async (toolInput, extra) => {
					const metadataToolCallId = extra._meta?.["claudecode/toolUseId"];
					const toolCallId =
						typeof metadataToolCallId === "string"
							? metadataToolCallId
							: randomUUID3();
					emit({
						input: JSON.stringify(toolInput),
						providerExecuted: false,
						toolCallId,
						toolName: tool.name,
						type: "tool-call",
					});
					const { output, isError } =
						await currentTurn.requestToolResult(toolCallId);
					emit({
						isError: !!isError,
						result: output ?? null,
						toolCallId,
						toolName: tool.name,
						type: "tool-result",
					});
					return {
						content: [{ text: JSON.stringify(output ?? null), type: "text" }],
						isError,
					};
				},
			);
		}
		mcpServers["harness-tools"] = {
			instance: server,
			name: "harness-tools",
			type: "sdk",
		};
	}
	query.compaction = createCompactionLatch((event) => emit(event));
	const skillsOption = toClaudeSkillsOption(start.skills);
	const nativeTools = resolveNativeTools(start.builtinToolFiltering);
	const inactiveNativeTools = resolveInactiveNativeTools(
		start.builtinToolFiltering,
	);
	const permissionOptions = createPermissionOptions({
		approvalRequestedToolUseIds: approvalIds,
		emit,
		finishApprovalStep: (approvalId) => {
			finishApprovalStep({ approvalId, emit, state: query.state });
		},
		inactiveNativeTools,
		nativeToolCallNames: toolCallNames,
		start,
		turn: currentTurn,
	});
	const questionPreToolUseHook = createQuestionPreToolUseHook({
		emit,
		nativeToolCallNames: toolCallNames,
		turn: currentTurn,
	});
	const resumeId = start.resumeSessionId ?? lastClaudeSessionId;
	query.q = claudeSdk.query({
		options: {
			...(start.model ? { model: start.model } : {}),
			...(start.maxTurns !== void 0 ? { maxTurns: start.maxTurns } : {}),
			...(start.env !== void 0 ? { env: { ...procEnv2, ...start.env } } : {}),
			...(skillsOption ? { skills: skillsOption } : {}),
			...(nativeTools !== void 0 ? { tools: nativeTools } : {}),
			...(inactiveNativeTools.length > 0
				? { disallowedTools: inactiveNativeTools }
				: {}),
			systemPrompt: createClaudeCodeSystemPrompt(start.instructions),
			thinking: start.thinking,
			...(start.effort !== void 0 ? { effort: start.effort } : {}),
			...(start.responseFormat?.type === "json" &&
			start.responseFormat.schema != null
				? {
						outputFormat: {
							schema: start.responseFormat.schema,
							type: "json_schema",
						},
					}
				: {}),
			includePartialMessages: true,
			hooks: {
				PostCompact: [
					{
						hooks: [
							async (hookInput) => {
								if (typeof hookInput?.compact_summary === "string") {
									query.compaction.onSummary(hookInput.compact_summary);
								}
								return {};
							},
						],
					},
				],
				PreToolUse: [
					{ hooks: [questionPreToolUseHook], matcher: "AskUserQuestion" },
				],
			},
			// The same continuation rule as the vendor driver: the exact
			// conversation id first, else `continue` after the first turn.
			...(resumeId
				? { resume: resumeId }
				: start.continue === true || !firstTurn
					? { continue: true }
					: {}),
			...permissionOptions,
			abortSignal: query.abort.signal,
			cwd: workdir,
			mcpServers,
		},
		prompt: input.iterable,
	});
	query.iterator = query.q[Symbol.asyncIterator]();
	return query;
}

/** Ends the CLI process of `query`; the next turn opens a new one. */
function closeQuery(query) {
	if (query.closed) {
		return;
	}
	query.closed = true;
	query.input.close();
	query.abort.abort();
	void Promise.resolve()
		.then(() => query.q?.return?.(void 0))
		.catch((error) => {
			// The abort above already ends the CLI; a failed return only logs.
			process.stderr.write(
				`[harness:claude-code:warn] query close failed: ${error?.message ?? error}\n`,
			);
		});
	if (liveQuery === query) {
		liveQuery = null;
	}
}

/**
 * Streams the messages of one turn until its `result`, then emits `finish`
 * and leaves the query open. An error or an ended CLI closes the query.
 */
async function driveTurn(query, start, turn) {
	query.turn = turn;
	query.state = createClaudeStreamEventState();
	const emit = (event) => turn.emit(event);
	let hardAbortTimer;
	// Esc semantics: the interrupt ends this turn and keeps the conversation.
	// The hard stop closes the CLI when the interrupt does not settle.
	const onHostAbort = () => {
		// 5 s: the same hard-stop fallback as the vendor driver.
		hardAbortTimer = setTimeout(() => closeQuery(query), 5e3);
		hardAbortTimer.unref?.();
		void Promise.resolve()
			.then(() => query.q.interrupt())
			.catch(() => closeQuery(query));
	};
	if (turn.abortSignal.aborted) {
		onHostAbort();
	} else {
		turn.abortSignal.addEventListener("abort", onHostAbort, { once: true });
	}
	// The fork does not support steering messages; a reject tells the host.
	void (async () => {
		for await (const message of turn.experimental_userMessages) {
			message.reject(new Error("The persistent bridge does not steer turns."));
		}
	})();
	let failure;
	const fail = (message) => {
		if (failure !== void 0) {
			return;
		}
		failure = message?.trim() || "Unknown error";
		query.state.observedTerminalError = failure;
		// The host's own stop ends with an error-shaped result; it is no error.
		if (!turn.abortSignal.aborted) {
			turn.emitError({ error: failure, message: "claude-code terminal error" });
		}
		closeQuery(query);
	};
	const emitStreamEvent = createEmitStreamEvent({
		emit,
		emitTerminalError: fail,
		emitWarning: turn.emitWarning,
		onCompactionBoundary: (boundary) => query.compaction.onBoundary(boundary),
		state: query.state,
		toCommonName,
	});
	let turnUsage;
	let totalCostUsd;
	try {
		for (;;) {
			const next = await query.iterator.next();
			if (next.done) {
				fail(
					query.state.observedTerminalError ?? "Claude Code ended the session",
				);
				return;
			}
			const msg = next.value;
			const sessionId = msg.session_id;
			if (typeof sessionId === "string" && sessionId.length > 0) {
				lastClaudeSessionId = sessionId;
			}
			emitStreamEvent(msg);
			if (failure !== void 0) {
				return;
			}
			if (msg.type !== "result") {
				continue;
			}
			if (turn.abortSignal.aborted) {
				return;
			}
			if (msg.subtype !== "success" || msg.is_error) {
				fail(
					(msg.subtype === "success"
						? msg.result?.trim()
						: Array.isArray(msg.errors)
							? msg.errors.join("\n")
							: msg.result) ||
						query.state.observedTerminalError ||
						(typeof msg.api_error_status === "number"
							? `Claude Code reported an API error (HTTP ${msg.api_error_status})`
							: "Claude Code reported a failed result"),
				);
				return;
			}
			if (!msg.result?.trim?.() && query.state.observedTerminalError) {
				fail(query.state.observedTerminalError);
				return;
			}
			const harnessUsage = mapUsage(msg.usage ?? msg.message?.usage);
			if (harnessUsage) {
				turnUsage = addUsage(turnUsage, harnessUsage);
			}
			if (typeof msg.total_cost_usd === "number") {
				totalCostUsd = (totalCostUsd ?? 0) + msg.total_cost_usd;
			}
			if (
				start.responseFormat?.type === "json" &&
				msg.structured_output !== void 0
			) {
				const id = randomUUID3();
				emit({ id, type: "text-start" });
				emit({
					delta: JSON.stringify(msg.structured_output),
					id,
					type: "text-delta",
				});
				emit({ id, type: "text-end" });
				query.state.stepOpen = true;
			}
			if (query.state.stepOpen) {
				emitFinishStep({
					emit,
					state: query.state,
					usage: query.state.pendingStepUsage ?? harnessUsage,
				});
			}
			break;
		}
	} catch (err) {
		closeQuery(query);
		if (!turn.abortSignal.aborted) {
			turn.emitError({ error: err, message: "claude-code turn failed" });
		}
		return;
	} finally {
		if (hardAbortTimer !== void 0) {
			clearTimeout(hardAbortTimer);
		}
		turn.abortSignal.removeEventListener("abort", onHostAbort);
		if (query.turn === turn) {
			query.turn = null;
		}
	}
	emit({
		finishReason: { raw: "stop", unified: "stop" },
		totalUsage: turnUsage ?? query.state.stepUsage ?? defaultUsage(),
		type: "finish",
		...(totalCostUsd !== void 0 || lastClaudeSessionId !== void 0
			? {
					harnessMetadata: {
						"claude-code": {
							...(totalCostUsd !== void 0 ? { costUsd: totalCostUsd } : {}),
							...(lastClaudeSessionId !== void 0
								? { sessionId: lastClaudeSessionId }
								: {}),
						},
					},
				}
			: {}),
	});
}
