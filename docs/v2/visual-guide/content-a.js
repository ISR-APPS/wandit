window.GUIDE_PART_A = [
  {
    "id": "v1-v2",
    "title": "From one page to an app",
    "subtitle": "The report changes the build process from one HTML page to a project with many files.",
    "group": "The change",
    "scene": "evolution",
    "sourceSections": "1–2",
    "sourceAnchor": "1-the-v1-flow-step-by-step",
    "steps": [
      {
        "title": "A message starts V1",
        "body": "The user asks for a booking page. In the V1 inspection, the server reserves credits and locks the chat. Then the Brain writes a design brief.",
        "caption": "The Brain describes the page before the V1 Builder writes it."
      },
      {
        "title": "The V1 Builder makes one page",
        "body": "The Brain calls generate_page once. A Trigger.dev task runs the V1 Builder with file tools and image tools. The V1 Builder keeps its files in memory.",
        "caption": "The V1 task produces one HTML file."
      },
      {
        "title": "The browser shows the HTML",
        "body": "The task processes the HTML and uploads index.html to R2. The web app asks for updates every 1.5 seconds. Its iframe shows the HTML through srcDoc.",
        "caption": "The iframe receives HTML text without a development server."
      },
      {
        "title": "V2 needs a full project",
        "body": "The proposed V2 app has components, routes, and many source files. A harness edits these files inside a sandbox. A development server shows the result.",
        "caption": "V2 adds a place to run the project during development."
      }
    ],
    "terms": [
      {
        "term": "Brain",
        "definition": "The V1 agent that writes the design brief.",
        "example": "The brief describes the booking page and its sections."
      },
      {
        "term": "V1 Builder",
        "definition": "The V1 agent that creates the HTML page with custom tools."
      },
      {
        "term": "HTML",
        "definition": "The document format that defines the structure of a web page."
      },
      {
        "term": "iframe",
        "definition": "A browser area that shows another document inside a page."
      },
      {
        "term": "srcDoc",
        "definition": "An iframe attribute that supplies HTML text directly."
      },
      {
        "term": "Development server",
        "definition": "A process that serves the app during development.",
        "example": "The preview changes after the harness edits a component."
      },
      {
        "term": "R2",
        "definition": "The object storage that the report uses for files and build output."
      },
      {
        "term": "Build",
        "definition": "A process that converts source files into files that a browser can load."
      },
      {
        "term": "React",
        "definition": "A JavaScript library for user interfaces."
      },
      {
        "term": "React component",
        "definition": "A reusable part of a user interface made with React.",
        "example": "The booking form can be a component with its own fields and buttons."
      },
      {
        "term": "KV",
        "definition": "Cloudflare key-value storage, which the report uses to connect a domain to a project."
      },
      {
        "term": "Cloudflare Worker",
        "definition": "A program that runs on Cloudflare servers instead of in the user browser.",
        "example": "The edge Worker serves published files."
      }
    ],
    "details": [
      {
        "title": "The first V1 request",
        "body": "The web app or native app sends POST /v1/chats/:chatId/ai-stream. The server reserves credits and takes a chat lock."
      },
      {
        "title": "The V1 task record",
        "body": "The generate_page tool creates a page_generation_attempts row. Then it starts the generate-page task. The inspection counts about 2,440 lines in site-builder-agent.ts."
      },
      {
        "title": "The custom V1 tools",
        "body": "The tools include write_file, edit_file, read_file, and list_files. Other tools generate images, animate images, take screenshots, and finish the page."
      },
      {
        "title": "The V1 limits",
        "body": "The inspection gives the V1 Builder a limit of 64 steps. A watchdog stops the V1 Builder after 180 seconds without output."
      },
      {
        "title": "The final HTML",
        "body": "The task puts GSAP inside the HTML. It processes fonts and images and adds a data-wid marker to each element. It creates a versions row."
      },
      {
        "title": "The old edit path",
        "body": "Seven chat tools edit the HTML through data-wid targets. They use 15 cheerio operation types. A large rebuild does not receive the previous HTML."
      },
      {
        "title": "The old public page",
        "body": "The publish process adds pixels, the leads script, and a badge. A KV pointer selects the project. The edge Worker serves one HTML file and ignores the URL path."
      },
      {
        "title": "The missing app features",
        "body": "The report identifies no generated backend, file tree, code view, terminal, or logs in V1. Its HTML edit tools cannot edit React components. Longer V2 tasks also need credit charges during each turn."
      }
    ],
    "quiz": {
      "question": "Why does the proposed V2 need a development server?",
      "options": [
        "To store the credit balance",
        "To run a project with many files and show its preview",
        "To replace the user message"
      ],
      "answer": 1,
      "explanation": "The development server runs the app during development. The preview shows its output."
    },
    "takeaway": "V1 produces one page. The proposed V2 edits and runs a project with many files."
  },
  {
    "id": "keep-fix",
    "title": "Keep the useful foundation",
    "subtitle": "The report keeps existing product systems and identifies gaps that can affect V2.",
    "group": "The change",
    "scene": "foundation",
    "sourceSections": "3–4",
    "sourceAnchor": "3-what-v1-keeps-for-v2",
    "steps": [
      {
        "title": "The product already has a base",
        "body": "The inspection finds login, workspaces, credits, and billing in V1. The proposed V2 keeps these systems. The new build process uses this existing base.",
        "caption": "V2 does not require a new account system."
      },
      {
        "title": "The interface also continues",
        "body": "The proposal keeps the project shell, chat pane, and split panels. It also keeps versions, leads, assets, and settings. New app tools extend this interface.",
        "caption": "The user keeps a familiar place to create projects."
      },
      {
        "title": "Some connections need correction",
        "body": "The inspection places Redis in San Francisco and the API in Europe. It also finds gaps in automated checks and staging login. The report puts these corrections before V2.",
        "caption": "The foundation needs corrections before it carries more traffic."
      },
      {
        "title": "A report is not an implementation",
        "body": "The report describes research and recommendations. Some repository items are references or unused code. Their presence does not mean that the product already includes their features.",
        "caption": "Each proposed feature still needs implementation and evidence."
      }
    ],
    "terms": [
      {
        "term": "Workspace",
        "definition": "A group of projects and members with access rules."
      },
      {
        "term": "Credit ledger",
        "definition": "The record of credit reservations, charges, and corrections."
      },
      {
        "term": "Staging",
        "definition": "An environment for product tests before production use."
      },
      {
        "term": "Production",
        "definition": "The environment that serves the real users of Wandit."
      },
      {
        "term": "Continuous integration",
        "definition": "Automatic checks that run after code changes.",
        "example": "A type check can detect an incorrect function argument."
      },
      {
        "term": "Feature flag",
        "definition": "A control that enables a feature for selected users or environments."
      },
      {
        "term": "MCP connector",
        "definition": "A connection that gives the agent tools from another service."
      },
      {
        "term": "Inspection",
        "definition": "The report section that describes what the authors found in the repository."
      }
    ],
    "details": [
      {
        "title": "Accounts and access",
        "body": "The proposal keeps Better Auth, organizations, the workspace header, and the role matrix. It also keeps the admin login and native login integration."
      },
      {
        "title": "Money and AI events",
        "body": "The proposal keeps the credit ledger, Stripe billing, and reserve, settle, and reconcile steps. It keeps the model gateway, usage records, error types, and Sentry reports."
      },
      {
        "title": "Jobs, domains, and leads",
        "body": "The proposal keeps Trigger.dev tasks and live job events. It also keeps custom domains, deployment records, and the public leads endpoint. Leads continue to support notifications and Google Sheets sync."
      },
      {
        "title": "Interface and data",
        "body": "The proposal keeps three languages, right-to-left layouts, and the native client. It keeps projects as the root data record. New database changes extend the existing structure."
      },
      {
        "title": "The four early corrections",
        "body": "The report moves Redis near the API. It adds automated type checks, tests, and edge Worker deployment. It also needs a staging domain arrangement that supports login."
      },
      {
        "title": "Unused systems",
        "body": "The inspection finds no active worker service for the old BullMQ path. The report chooses the existing Trigger.dev system. It also finds an unused V2 experiment project."
      },
      {
        "title": "References are not features",
        "body": "The inspected simulator branch has no simulator implementation. The Lovable prompt file has no code importer. The partial _cc-harness copy lacks a package manifest and has an unresolved license."
      },
      {
        "title": "Connectors and rollout",
        "body": "The inspected MCP connectors provide agent tools for services such as Meta Ads. They do not provide a backend for generated apps. Existing feature flags and kill switches can control the V2 rollout."
      }
    ],
    "quiz": {
      "question": "Which statement matches the report?",
      "options": [
        "V2 must replace all login and billing code",
        "A simulator reference means that the product has a simulator",
        "V2 can keep login and billing while it replaces the build process"
      ],
      "answer": 2,
      "explanation": "The report keeps useful product systems. It replaces the parts that cannot build and run a full app."
    },
    "takeaway": "V2 changes the build process while it keeps useful product systems and corrects known gaps."
  },
  {
    "id": "coding-harness",
    "title": "The model, harness, and machine",
    "subtitle": "These three parts have different roles in the proposed build process.",
    "group": "The build",
    "scene": "harness",
    "sourceSections": "5, 6.1, 8.2",
    "sourceAnchor": "6-1-the-coding-agent-or-harness",
    "steps": [
      {
        "title": "The model proposes an action",
        "body": "The user asks for a booking form. The model receives context and produces text or a tool request. The model does not provide the project machine.",
        "caption": "The model supplies a proposed response or action."
      },
      {
        "title": "The harness runs the tools",
        "body": "The harness controls the model loop, tools, permissions, and session history. It can read a file and run a command. Then it sends the result to the model.",
        "caption": "The harness connects model responses to controlled actions."
      },
      {
        "title": "The sandbox contains the project",
        "body": "The harness runs inside the sandbox. The sandbox contains the files, command processes, and development server. A file tool changes a real file in this machine.",
        "caption": "The sandbox supplies the machine where the tools act."
      },
      {
        "title": "V2 uses one harness path",
        "body": "The report proposes HarnessAgent with a Claude Code adapter. Questions and code changes use the same harness path. V2 removes the separate Brain agent.",
        "caption": "The template supplies the design rules that the Brain previously used."
      }
    ],
    "terms": [
      {
        "term": "Model",
        "definition": "The AI system that produces responses from the supplied context."
      },
      {
        "term": "Agent",
        "definition": "A system that uses a model and tools to act on a task."
      },
      {
        "term": "Coding harness",
        "definition": "Software that supplies the model loop, tools, permissions, and session history."
      },
      {
        "term": "Tool",
        "definition": "An operation that the harness or server exposes to the agent.",
        "example": "A file tool reads a component before the agent changes it."
      },
      {
        "term": "Adapter",
        "definition": "Software that connects one interface to another interface."
      },
      {
        "term": "SDK",
        "definition": "A software development kit that provides interfaces for another product."
      },
      {
        "term": "Session",
        "definition": "The context and history that the harness keeps across related work."
      },
      {
        "term": "Hook",
        "definition": "A defined point where custom code can respond to a harness event."
      },
      {
        "term": "Claude Agent SDK",
        "definition": "An Anthropic software package that runs the Claude Code engine from another program."
      },
      {
        "term": "HarnessAgent",
        "definition": "The AI SDK interface that the report proposes to start and control a coding harness inside a sandbox."
      }
    ],
    "details": [
      {
        "title": "The proposed entry point",
        "body": "The report chooses AI SDK HarnessAgent with the Claude Code adapter. It describes @ai-sdk/harness as experimental. The reported package versions need a separate implementation check."
      },
      {
        "title": "What the adapter connects",
        "body": "The report says that the adapter starts the Claude Agent SDK and CLI inside the sandbox. A WebSocket connection returns harness events to the host."
      },
      {
        "title": "The direct alternative",
        "body": "The report keeps the Claude Agent SDK as an alternative. This path runs the agent in containers under Wandit control. The same prompts, skills, and tools can continue."
      },
      {
        "title": "Why a managed session is different",
        "body": "The report also examines Anthropic Managed Agents. It finds no documented preview port for that option. It therefore does not choose that option for an interactive builder."
      },
      {
        "title": "The Brain rules move",
        "body": "The proposed template contains CLAUDE.md, design skills, and brief rules. Server tools provide ask_user and generate_image. The handoff from the Brain to the V1 Builder ends."
      },
      {
        "title": "History and messages",
        "body": "The report keeps harness history in the session. The server stores resume state instead of resending the complete transcript. Harness events use the existing message stream format."
      },
      {
        "title": "Tools and usage",
        "body": "The proposal permits built-in tools under defined permission rules. Wandit tools that spend money or publish need user approval. The report prices model usage from token counts."
      },
      {
        "title": "Open implementation questions",
        "body": "The report needs evidence for hook events, usage events, cancellation, and provider access. It also needs a written license answer before external use. Its diagram and prose differ on session scope per chat or project."
      }
    ],
    "quiz": {
      "question": "Which part supplies the file tools, permissions, and model loop?",
      "options": [
        "The coding harness",
        "The preview iframe",
        "The Redis lock"
      ],
      "answer": 0,
      "explanation": "The harness supplies these controls. The sandbox supplies the machine, and the model supplies responses."
    },
    "takeaway": "The model proposes actions. The harness controls tools. The sandbox supplies the machine."
  },
  {
    "id": "sandbox",
    "title": "A private workshop for each project",
    "subtitle": "The sandbox is a cloud machine with project files and processes.",
    "group": "The build",
    "scene": "workshop",
    "sourceSections": "5, 6.2, 8.2–8.3, 13",
    "sourceAnchor": "6-2-the-sandbox",
    "steps": [
      {
        "title": "The task opens the workshop",
        "body": "The report proposes one sandbox per project. A new project receives a prepared machine image. An existing project resumes its previous files.",
        "caption": "Each project has a separate place for its code."
      },
      {
        "title": "Files and processes are different",
        "body": "The disk contains the project files. Memory contains the state of active processes. The harness and development server use both while the machine runs.",
        "caption": "A saved file and a running server are different things."
      },
      {
        "title": "The machine can stop",
        "body": "The proposed Vercel path saves a disk snapshot before the sandbox stops. This snapshot preserves files. It does not preserve the running development server.",
        "caption": "The workshop can close while its files remain available."
      },
      {
        "title": "The next turn resumes the project",
        "body": "The next task restores the disk and starts the required processes. The development server and browser service start again. Durable Git bundles provide another recovery path.",
        "caption": "The files return before the preview becomes ready."
      }
    ],
    "terms": [
      {
        "term": "Sandbox",
        "definition": "An isolated environment where the project code and tools run."
      },
      {
        "term": "Disk",
        "definition": "Storage for files that can remain after processes stop."
      },
      {
        "term": "Memory",
        "definition": "The machine resource that holds the state of active processes."
      },
      {
        "term": "Process",
        "definition": "A program that the machine runs.",
        "example": "Vite is a development server process for the proposed web app."
      },
      {
        "term": "Snapshot",
        "definition": "A saved state of the sandbox. Its contents depend on the provider."
      },
      {
        "term": "Machine image",
        "definition": "A prepared starting disk with the required software."
      },
      {
        "term": "MicroVM",
        "definition": "A small virtual machine with its own operating-system kernel."
      },
      {
        "term": "Port",
        "definition": "A numbered network endpoint that a process uses to receive traffic."
      },
      {
        "term": "Vite",
        "definition": "The development server and build tool that the report chooses for web apps."
      },
      {
        "term": "Firecracker microVM",
        "definition": "A small virtual machine that uses Firecracker software. The report selects this type of isolation for the coding agent."
      },
      {
        "term": "Kernel",
        "definition": "The central software of an operating system. It controls access to machine resources."
      },
      {
        "term": "Container",
        "definition": "An isolated process environment that usually shares the host kernel. A virtual machine has its own kernel."
      },
      {
        "term": "WebContainers",
        "definition": "A system that runs a development environment inside the browser. The report does not select it for its Claude Code path."
      }
    ],
    "details": [
      {
        "title": "The proposed first provider",
        "body": "The report chooses Vercel Sandbox in the Paris region, cdg1. Its stated reason is an available harness adapter. This guide does not independently establish current provider support."
      },
      {
        "title": "The prepared image",
        "body": "The proposed image includes Node 22, pnpm, Git, Chromium, and the Expo CLI. The report estimates two virtual CPUs and 4 GB of memory."
      },
      {
        "title": "The processes and ports",
        "body": "The harness, development server, and browser service need network connections. The report describes Vite for web and Metro for mobile. The final port arrangement needs the proposed early tests."
      },
      {
        "title": "Isolation has controls",
        "body": "The proposal uses a non-root user and denies network output by default. Real platform credentials stay outside the sandbox. Isolation still depends on correct permissions and network controls."
      },
      {
        "title": "The alternative providers",
        "body": "The report lists Cloudflare Sandboxes as the second choice and E2B as the third choice. It proposes a SandboxProvider interface. A different provider needs a compatible harness adapter."
      },
      {
        "title": "Snapshot behavior differs",
        "body": "The report describes disk-only snapshots for its Vercel choice and disk plus memory for E2B. These provider claims need current evidence. A Git version remains separate from a machine snapshot."
      },
      {
        "title": "The idle limit conflicts",
        "body": "Section 8.2 proposes a stop after 20 idle minutes. Section 8.3 says 10 minutes. The final idle limit remains an open decision."
      },
      {
        "title": "Recovery and measurements",
        "body": "The report rebuilds the sandbox from R2 bundles after snapshot expiry. Early tests must measure start time, resume time, preview traffic, and cancellation. Provider prices and quotas also need current evidence."
      }
    ],
    "quiz": {
      "question": "What must happen after a disk-only snapshot restores the project?",
      "options": [
        "Redis must rewrite all source files",
        "The development server must start again",
        "The public app must lose its database"
      ],
      "answer": 1,
      "explanation": "The disk snapshot restores files. It does not restore the memory of the previous server process."
    },
    "takeaway": "The sandbox can stop between turns. Files can survive while processes need to start again."
  },
  {
    "id": "jobs-redis",
    "title": "The build continues after a tab closes",
    "subtitle": "The background task runs the turn. Redis carries progress and helps control concurrent changes.",
    "group": "The build",
    "scene": "relay",
    "sourceSections": "6.8, 8.2, 9",
    "sourceAnchor": "6-8-streaming-and-background-jobs",
    "steps": [
      {
        "title": "The API admits the turn",
        "body": "The user sends a message. The API makes sure that access, plan limits, and credit balance permit the turn. It creates a turn record and returns its identifier.",
        "caption": "The request starts a job instead of holding the full build inside the request."
      },
      {
        "title": "The background task owns the job",
        "body": "The report assigns the turn to a Trigger.dev task. This task starts or resumes the sandbox and harness. A project queue permits one active turn.",
        "caption": "The task can continue independently of the browser tab."
      },
      {
        "title": "Redis relays progress",
        "body": "The task sends each progress event to a Redis Stream and a Trigger stream. Redis supplies the browser stream. The report uses the Trigger stream as a durable copy.",
        "caption": "Redis carries events without becoming the coding agent."
      },
      {
        "title": "The browser reconnects",
        "body": "A closed tab loses its connection. On return, the browser requests events after its last event identifier. The report also provides an explicit cancel action.",
        "caption": "A lost connection and a canceled turn are different states."
      }
    ],
    "terms": [
      {
        "term": "Turn",
        "definition": "One user request and the agent work that responds to that request."
      },
      {
        "term": "Background task",
        "definition": "A job that can continue outside the lifetime of one browser request."
      },
      {
        "term": "Redis Stream",
        "definition": "An ordered series of events that consumers can read by event identifier."
      },
      {
        "term": "Lock",
        "definition": "A temporary ownership record that helps prevent concurrent changes to the same project."
      },
      {
        "term": "Queue",
        "definition": "A system that holds jobs until capacity becomes available."
      },
      {
        "term": "Idempotency key",
        "definition": "An identifier that helps prevent a repeated request from starting the same job twice."
      },
      {
        "term": "Fencing identifier",
        "definition": "A turn identifier that helps reject writes from an old owner."
      },
      {
        "term": "SSE",
        "definition": "Server-sent events, a connection through which the server sends updates to the browser."
      },
      {
        "term": "Redis",
        "definition": "A data store that the proposal uses for progress events, temporary locks, and rate limits."
      },
      {
        "term": "Trigger.dev",
        "definition": "The background job service that the report uses to run the task for each turn."
      },
      {
        "term": "API",
        "definition": "An interface through which one program requests an action or data from another program."
      }
    ],
    "details": [
      {
        "title": "The admission record",
        "body": "The proposal uses POST /api/v2/projects/:id/turns with the workspace header. The API reserves credits, takes the lock, and writes builder_turns. The task uses turnId as its idempotency key."
      },
      {
        "title": "One task per project",
        "body": "The builder-turn queue has one slot per project. A later message waits for the active turn. This rule prevents two turns from editing the project at once."
      },
      {
        "title": "Several ownership controls",
        "body": "The report combines a Redis lock, an active-turn database index, the queue, and a fencing identifier. A heartbeat renews the lock. The lock alone does not run or preserve the job."
      },
      {
        "title": "A resumable browser stream",
        "body": "The browser reads SSE through a custom ChatTransport. Last-Event-ID identifies its most recent event. reconnectToStream resumes event delivery after a page refresh."
      },
      {
        "title": "Two event copies",
        "body": "The Redis Stream supports the browser relay. The Trigger stream supplies the durable copy in the proposal. Neither stream replaces Git storage for project files."
      },
      {
        "title": "Credit control during a turn",
        "body": "The task records checkpoint debits during a long turn. It makes sure that the balance and project limit permit further work. The final settlement uses token counts."
      },
      {
        "title": "Cancel and stale writes",
        "body": "The report proposes runs.cancel and a commit of unfinished work. A fencing identifier helps reject writes from an old turn. Cancellation behavior still needs an early test."
      },
      {
        "title": "Host connection limits",
        "body": "The report identifies a WebSocket risk during long Trigger.dev waits. It proposes detaching the session before the wait. It marks an abrupt host abort without detach as unresolved."
      }
    ],
    "quiz": {
      "question": "The user closes the tab during a build. What does the proposal intend?",
      "options": [
        "Redis writes the app code",
        "The task deletes the project",
        "The background task continues, and the browser can reconnect"
      ],
      "answer": 2,
      "explanation": "The Trigger.dev task runs the turn. The browser connection only receives progress."
    },
    "takeaway": "Trigger.dev runs the job. Redis relays progress and helps coordinate ownership. The browser can reconnect."
  },
  {
    "id": "preview",
    "title": "A protected window into the app",
    "subtitle": "The preview shows the development server through an access-controlled connection.",
    "group": "The build",
    "scene": "preview",
    "sourceSections": "5, 6.8–6.9, 8.2, 9",
    "sourceAnchor": "8-2-the-choice-per-block",
    "steps": [
      {
        "title": "The app runs in the sandbox",
        "body": "The development server reads the source files and serves the app. The browser needs a route to that server. The preview iframe provides the visible area.",
        "caption": "The iframe shows the app from the development server."
      },
      {
        "title": "A proxy controls entry",
        "body": "The report puts a preview proxy between the iframe and the sandbox. The proxy makes sure that the request has valid access. Then it forwards permitted traffic.",
        "caption": "The proxy controls access to the preview connection."
      },
      {
        "title": "A file change updates the view",
        "body": "The harness changes the booking form. The development server sends an update through a WebSocket connection. Hot reload updates the preview during development.",
        "caption": "The user can see a change before a public release."
      },
      {
        "title": "Errors return useful evidence",
        "body": "The proposed browser service reads console errors and captures screenshots. The task can use this evidence for a limited correction loop. This automatic correction remains optional.",
        "caption": "A visible preview can reveal errors that source files do not show."
      }
    ],
    "terms": [
      {
        "term": "Preview",
        "definition": "A view of the app during development, before a public release."
      },
      {
        "term": "Preview proxy",
        "definition": "A service that controls access and forwards traffic to the development server."
      },
      {
        "term": "Signed token",
        "definition": "A value with a signature that the server can use to establish permitted access."
      },
      {
        "term": "Origin",
        "definition": "The combination of a URL scheme, host, and port that a browser treats as a security boundary."
      },
      {
        "term": "WebSocket",
        "definition": "A connection that permits messages in both directions between a browser and server."
      },
      {
        "term": "Hot reload",
        "definition": "A development feature that updates the preview after source changes."
      },
      {
        "term": "Playwright",
        "definition": "A browser automation tool that the report uses for screenshots and error evidence."
      },
      {
        "term": "Public Suffix List",
        "definition": "A list that browsers use to identify boundaries between independent sites."
      }
    ],
    "details": [
      {
        "title": "The proposed domain boundary",
        "body": "The report chooses a separate preview domain and a separate origin per project and run. This boundary reduces shared access between generated content and the Wandit interface."
      },
      {
        "title": "The proposed proxy",
        "body": "A small Cloudflare Worker provides the preview proxy. The report gives its signed token a lifetime of 15 minutes. The proxy sets a cookie and forwards HTTP and WebSocket traffic."
      },
      {
        "title": "Why the iframe needs this path",
        "body": "An iframe navigation cannot add arbitrary custom request headers. The proposal therefore uses a token and cookie flow. It avoids a preview that depends on custom iframe headers."
      },
      {
        "title": "A private preview needs more than a label",
        "body": "The report describes the selected provider URL as public. The complete access design must prevent unauthorized access through alternative routes. The proxy and provider behavior need an implementation check."
      },
      {
        "title": "Browser permission rules",
        "body": "The report requires login support inside the preview. It combines a separate domain, frame-ancestors headers, and restricted iframe permissions. It excludes allow-top-navigation and proposes a Public Suffix List entry."
      },
      {
        "title": "The update connection",
        "body": "Hot reload needs the proxy to forward WebSocket traffic. The early tests measure preview access and data transfer. A visible HTML page alone does not establish that hot reload works."
      },
      {
        "title": "Optional error correction",
        "body": "The proposal reads development-server logs and browser console errors. An iframe postMessage connection can report user errors. A limited correction loop prevents an endless series of repair attempts."
      },
      {
        "title": "Preview and publish differ",
        "body": "The preview serves the app from the development server. A public release serves separate build output. A sandbox stop therefore has a different purpose from an unpublish action."
      }
    ],
    "quiz": {
      "question": "What does the preview proxy do?",
      "options": [
        "It controls access and forwards traffic to the development server",
        "It stores all customer bookings",
        "It replaces the source files with screenshots"
      ],
      "answer": 0,
      "explanation": "The proxy controls the connection to the preview. The development server still runs inside the sandbox."
    },
    "takeaway": "The preview is a protected view of a development server. It is separate from the public release."
  },
  {
    "id": "backend",
    "title": "Where the app keeps real data",
    "subtitle": "The generated app needs its own backend for accounts, records, files, and server functions.",
    "group": "The app",
    "scene": "backend",
    "sourceSections": "5, 6.4, 8.2, 11–13",
    "sourceAnchor": "6-4-the-backend-for-user-apps",
    "steps": [
      {
        "title": "A form needs a place for records",
        "body": "The booking page shows fields and buttons. Real bookings need a database that stores records after a browser closes. App login also needs an account service.",
        "caption": "The visible page and its stored records have different roles."
      },
      {
        "title": "The first data need creates a backend",
        "body": "The report proposes one Supabase project per generated app. The ensure_backend tool creates it at the first backend requirement. A simple landing page can keep the existing leads path.",
        "caption": "The proposal creates a backend only after the app needs one."
      },
      {
        "title": "The app uses separate services",
        "body": "The proposed backend provides a database, login, file storage, and server functions. Jobs and email extend the app. Sensitive credentials stay in controlled server locations.",
        "caption": "The sandbox edits the app while the backend supplies its data services."
      },
      {
        "title": "Wandit shows the backend controls",
        "body": "The proposed Cloud tab shows data, users, files, functions, and logs. A server proxy controls these operations. The report also proposes idle pauses and an ownership transfer path.",
        "caption": "The user manages app services through Wandit."
      }
    ],
    "terms": [
      {
        "term": "Backend",
        "definition": "The services that store app data and run operations outside the browser."
      },
      {
        "term": "Database",
        "definition": "A system that stores structured records.",
        "example": "Each booking can have a customer, a date, and a status."
      },
      {
        "term": "Authentication",
        "definition": "The process that establishes which user makes a request."
      },
      {
        "term": "File storage",
        "definition": "A service that stores files such as customer images or documents."
      },
      {
        "term": "Server function",
        "definition": "Code that runs in the backend instead of the browser."
      },
      {
        "term": "Secret",
        "definition": "A credential or sensitive value that unauthorized users must not receive."
      },
      {
        "term": "Row Level Security",
        "definition": "Database rules that control which rows a user can read or change."
      },
      {
        "term": "Claim path",
        "definition": "A proposed way for the user to take ownership of the backend outside Wandit."
      },
      {
        "term": "Supabase",
        "definition": "The backend provider that the report chooses for app databases, login, file storage, and server functions."
      },
      {
        "term": "SQL",
        "definition": "A language that programs use to read and change relational database records and structures."
      },
      {
        "term": "Supabase Management API",
        "definition": "An interface that lets Wandit create and control Supabase projects for its users."
      },
      {
        "term": "Supabase for Platforms",
        "definition": "The partner program that the report proposes for a product that creates Supabase projects for its users."
      }
    ],
    "details": [
      {
        "title": "Two databases have different roles",
        "body": "The Wandit database stores product records such as projects, turns, and credit usage. The generated app database stores app records such as bookings. The proposal keeps these roles separate."
      },
      {
        "title": "The proposed provider",
        "body": "The report chooses Supabase through its Management API. Wandit owns the organizations that contain app projects. A BackendProvider interface permits another provider, such as Neon, later."
      },
      {
        "title": "The app services",
        "body": "The proposal uses Supabase Auth for app accounts and Supabase services for data, files, and functions. It uses pg_cron for jobs. Row Level Security controls access to records."
      },
      {
        "title": "Credentials and tools",
        "body": "The proposal keeps platform credentials and service keys on the server. The harness receives limited tool access or a proxy token. Tools include apply_migration, run_sql, deploy_function, and set_secret."
      },
      {
        "title": "Email and payments",
        "body": "The report proposes Resend with a separate domain per tenant. The first payment path uses a user-supplied Stripe restricted key. Regional payment availability remains an open question in the report."
      },
      {
        "title": "The Cloud tab",
        "body": "The proposed panels include database rows, SQL, users, storage, secrets, logs, functions, and jobs. Secret controls accept new values without showing existing values. A server proxy controls the provider operations."
      },
      {
        "title": "Idle services and costs",
        "body": "The report proposes a backend pause after seven idle days and a visible resume state. It treats backend capacity as a plan entitlement. Provider limits, partner prices, and creation times need evidence."
      },
      {
        "title": "The ownership date conflicts",
        "body": "Section 8.2 proposes a claim path from the first release. The phase plan places claim export in P6. The report therefore leaves the delivery date unresolved."
      }
    ],
    "quiz": {
      "question": "Where does the proposed booking app keep its customer booking records?",
      "options": [
        "Only in the preview iframe",
        "In its app backend database",
        "In the Redis lock"
      ],
      "answer": 1,
      "explanation": "The app backend stores booking records. Wandit records and build coordination have separate storage roles."
    },
    "takeaway": "The sandbox creates the code. The app backend stores records and provides services after development."
  },
  {
    "id": "mobile",
    "title": "The mobile app has several preview paths",
    "subtitle": "The report starts with Expo web and a phone, then adds richer device previews in later phases.",
    "group": "The app",
    "scene": "mobile",
    "sourceSections": "5, 6.5, 8.2, 11–13",
    "sourceAnchor": "6-5-mobile-apps-with-expo",
    "steps": [
      {
        "title": "The user chooses a mobile project",
        "body": "The proposal chooses web or mobile at project creation. A mobile project uses an Expo template. The same sandbox concept supplies files and tools for this project.",
        "caption": "The project target determines the template."
      },
      {
        "title": "The browser shows an early preview",
        "body": "The report first shows Expo web inside a phone frame. Metro serves the mobile JavaScript bundle. A QR code provides the proposed route to Expo Go on a phone.",
        "caption": "A phone-shaped browser preview is still a web preview."
      },
      {
        "title": "Native features need a compatible app",
        "body": "Expo Go supports a defined set of native modules. The report later proposes a Wandit preview app with expo-dev-client. This app receives JavaScript from the sandbox.",
        "caption": "The installed preview app determines which native modules can run."
      },
      {
        "title": "Hosted devices come later",
        "body": "The report proposes Appetize for a device view inside the browser. Own Android emulators and Mac simulators belong to later phases. EAS provides the proposed build and store-submission path.",
        "caption": "A streamed device requires more infrastructure than a web preview."
      }
    ],
    "terms": [
      {
        "term": "Expo",
        "definition": "The framework and tools that the report chooses for generated mobile apps."
      },
      {
        "term": "Metro",
        "definition": "The development server and bundler for the proposed React Native project."
      },
      {
        "term": "Expo Go",
        "definition": "A phone app that loads compatible Expo projects with its included native modules."
      },
      {
        "term": "Development client",
        "definition": "A custom preview app with a selected set of native modules."
      },
      {
        "term": "Native module",
        "definition": "Code that connects the app to device capabilities outside browser JavaScript."
      },
      {
        "term": "EAS",
        "definition": "Expo Application Services, the proposed service for app builds and store submission."
      },
      {
        "term": "Appetize",
        "definition": "The hosted device service that the report proposes for an embedded device preview."
      },
      {
        "term": "KVM",
        "definition": "Linux virtualization support that the report requires for usable Android emulator speed."
      },
      {
        "term": "Expo dev client",
        "definition": "A custom preview app that includes the native modules of a particular project."
      },
      {
        "term": "serve-sim",
        "definition": "A macOS tool that sends an iOS Simulator view and touch controls to a browser."
      }
    ],
    "details": [
      {
        "title": "The first mobile phase",
        "body": "The report proposes an Expo web preview and an Expo Go QR code. The template must match the supported Expo SDK. The module list stays within that preview support."
      },
      {
        "title": "A web preview has limits",
        "body": "The report identifies gaps for camera, biometrics, purchases, and other native modules. A phone frame changes the appearance of the preview. It does not add native device capabilities."
      },
      {
        "title": "Expo Go needs a real-device test",
        "body": "The report makes dated claims about Expo Go ownership rules, store versions, and OAuth limits. It lists a real-phone test before implementation. Those claims are not current evidence in this guide."
      },
      {
        "title": "The next preview app",
        "body": "The report proposes a Wandit app with expo-dev-client on TestFlight and Google Play internal testing. Its native modules must match generated app requirements. Appetize can provide another preview path on demand."
      },
      {
        "title": "The Metro connection",
        "body": "The report places Metro in the sandbox on port 8081. A preview proxy exposes the permitted connection. The plan includes EXPO_PACKAGER_PROXY_URL and a test of Appetize access to Metro."
      },
      {
        "title": "Hosted devices have limits",
        "body": "The report assigns session limits and minute entitlements to Appetize. Own Android emulators need a separate host fleet with KVM. Exact prices and provider limits require current evidence."
      },
      {
        "title": "Mac simulators are later work",
        "body": "The report places Mac simulators and serve-sim after Android emulators. The inspected desktop tool is a reference, not a product component. A login proxy and legal review remain necessary in that proposal."
      },
      {
        "title": "Builds and store accounts",
        "body": "The report keeps EAS for builds and store submission. Users need Apple and Google developer accounts. The listed account fees and tester requirements need current evidence before a store release."
      }
    ],
    "quiz": {
      "question": "Does a phone frame around Expo web create a native device preview?",
      "options": [
        "Yes, the frame adds camera and biometric support",
        "Yes, the frame starts an iOS simulator",
        "No, the app still runs as a web preview"
      ],
      "answer": 2,
      "explanation": "The frame changes the visible shape. Native features need a compatible device, development client, or hosted device environment."
    },
    "takeaway": "Expo web, a phone preview app, and a hosted device are different preview paths with different capabilities."
  }
];
