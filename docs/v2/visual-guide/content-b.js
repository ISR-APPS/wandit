window.GUIDE_PART_B = [
  {
    "id": "versions",
    "title": "Return to earlier code",
    "subtitle": "The proposed version system keeps a record after each chat change.",
    "group": "Protect and publish",
    "scene": "versions",
    "sourceSections": "6.7, 8.2, 13",
    "sourceAnchor": "6-7-version-history",
    "steps": [
      {
        "title": "The coding agent changes files",
        "body": "The coding agent adds a booking form to your app. Git records the project files and their changes.",
        "caption": "Your app now contains a new booking form."
      },
      {
        "title": "The server saves a version",
        "body": "At the end of the turn, the server creates a commit. A commit identifies this exact set of code changes.",
        "caption": "One chat change becomes one version in the list."
      },
      {
        "title": "A separate store protects history",
        "body": "The original proposal sends a Git bundle to R2. The bundle keeps code history outside the sandbox.",
        "caption": "The code history remains available after the sandbox stops."
      },
      {
        "title": "Restore copies earlier code forward",
        "body": "You select an earlier version of the booking form. The server copies that code into a new commit. Existing bookings in the database stay unchanged.",
        "caption": "Code restore does not restore database data."
      }
    ],
    "terms": [
      {
        "term": "Git",
        "definition": "A tool that records changes to project files.",
        "example": "Git records the code before and after the coding agent adds a form."
      },
      {
        "term": "Commit",
        "definition": "A recorded set of file changes with an identifier.",
        "example": "The server labels a commit msg/<messageId>."
      },
      {
        "term": "Commit SHA",
        "definition": "The long identifier that names a particular Git commit."
      },
      {
        "term": "Branch",
        "definition": "A separate line of code changes within the same project.",
        "example": "A later phase gives each chat its own branch."
      },
      {
        "term": "Git bundle",
        "definition": "A file that contains Git history for transfer or recovery."
      },
      {
        "term": "Fork",
        "definition": "A separate copy of a project that can receive independent changes."
      },
      {
        "term": "Merge",
        "definition": "The process that combines code changes from separate branches."
      },
      {
        "term": "Patch",
        "definition": "A file that describes the text changes between code versions."
      },
      {
        "term": "Numstat",
        "definition": "A Git summary that counts added and deleted lines for each changed file."
      },
      {
        "term": "Sandbox snapshot",
        "definition": "A provider-specific record of sandbox state.",
        "example": "The proposed Vercel path saves disk state. It restarts processes after resume. Git provides the code version history."
      }
    ],
    "details": [
      {
        "title": "Why the report requires Git",
        "body": "Claude Code file checkpoints cover its Write and Edit tools. The report says that they miss changes from shell commands. A Git repository records those changes too."
      },
      {
        "title": "The original R2 design",
        "body": "After each commit, the sandbox sends a bundle, a patch, and a numstat file to R2 under git/{projectId}/. Every 50 commits, it sends a full bundle. This design is a proposal."
      },
      {
        "title": "The version records",
        "body": "app_commits, app_bundles, and app_branches supply the version list. A compare-and-swap rule accepts an update only if the recorded starting version still matches."
      },
      {
        "title": "Restore keeps the later history",
        "body": "A copy-forward restore creates a new commit with earlier code. It keeps the later commits available. The report uses the same approach as V1 page restoration."
      },
      {
        "title": "Code and data have separate histories",
        "body": "A code restore changes files. It does not reverse payments, delete new users, or restore earlier database rows. A database restore needs a separate process."
      },
      {
        "title": "Git rules and later export",
        "body": "The server controls commits. The agent cannot run git push, git reset, or git checkout. Media and secrets stay outside Git. Later phases add branches per chat and GitHub export through a GitHub App."
      },
      {
        "title": "Why the report rejects a snapshot per message",
        "body": "The report estimates about $32 monthly per project for large snapshots after messages. It estimates much smaller costs for source-only Git history. These figures are planning estimates, not measured Wandit costs."
      },
      {
        "title": "A later amendment changes the storage choice",
        "body": "Section 6.7 adds code.storage, a managed Git service. It proposes a P0 experiment and adoption from day one if that experiment passes. R2 bundles remain the fallback. The later synthesis still lists R2 bundles as the first choice."
      },
      {
        "title": "What code.storage can replace",
        "body": "The report says that code.storage supplies repositories through an API and supports normal Git operations. It can replace bundle transfer and a later Gitea remote. Its prices and scale claims need the proposed experiment."
      }
    ],
    "quiz": {
      "question": "You restore code from yesterday. What happens to bookings received today?",
      "options": [
        "The bookings disappear.",
        "The bookings stay in the database.",
        "Git sends the bookings to GitHub."
      ],
      "answer": 1,
      "explanation": "The proposed restore changes code only. Database data has a separate lifecycle."
    },
    "takeaway": "A version is a record of code. A restore creates a new code version without changing database data."
  },
  {
    "id": "publish",
    "title": "Put the finished app on the web",
    "subtitle": "The proposed host serves a finished build from Cloudflare and R2.",
    "group": "Protect and publish",
    "scene": "publish",
    "sourceSections": "6.6, 8.1–8.3, 11",
    "sourceAnchor": "6-6-hosting-and-publish",
    "steps": [
      {
        "title": "Make the finished files",
        "body": "The publish task runs vite build inside the sandbox. This command creates the finished website files in the dist folder.",
        "caption": "The development preview and the finished build have different jobs."
      },
      {
        "title": "Store files and their list",
        "body": "The task sends the files to R2. A manifest records which files belong to this deployment. A file hash identifies its content.",
        "caption": "One deployment has one exact set of files."
      },
      {
        "title": "Select the live deployment",
        "body": "The publish task changes current.json after the required checks pass. This small object identifies the deployment that visitors receive.",
        "caption": "The live selector changes after the new build is ready."
      },
      {
        "title": "Visitors receive the app",
        "body": "The wandit-edge Worker reads the live selection and serves the files. Your published site remains separate from the development server inside the sandbox.",
        "caption": "The sandbox preview supports your work, while the published site serves visitors."
      }
    ],
    "terms": [
      {
        "term": "Build",
        "definition": "The process that turns source code into files that a browser can use.",
        "example": "Vite creates HTML, JavaScript, CSS, and other files in dist."
      },
      {
        "term": "Hash",
        "definition": "An identifier calculated from file content.",
        "example": "The proposed store uses a SHA-256 hash to identify a file."
      },
      {
        "term": "Deployment",
        "definition": "A prepared version of an app that a host can serve to visitors."
      },
      {
        "term": "KV",
        "definition": "Cloudflare storage that associates each key with a value.",
        "example": "The existing KV record connects a domain to its project route."
      },
      {
        "term": "MIME content type",
        "definition": "A response label that tells a browser how to interpret a file.",
        "example": "text/html identifies an HTML document."
      },
      {
        "term": "Manifest",
        "definition": "A list of the files that belong to one deployment."
      },
      {
        "term": "Pointer",
        "definition": "A small record that identifies another record or location.",
        "example": "current.json selects the live deployment."
      },
      {
        "term": "SPA fallback",
        "definition": "A rule that serves index.html for an app route without a matching file.",
        "example": "React Router then shows the booking page at /bookings."
      },
      {
        "term": "CDN",
        "definition": "A network that serves cached website files from locations near visitors."
      },
      {
        "term": "Cloudflare for SaaS",
        "definition": "The domain service that the proposal keeps for customer domains."
      },
      {
        "term": "Workers for Platforms",
        "definition": "A later proposed service for customer apps that need their own server code."
      }
    ],
    "details": [
      {
        "title": "Preview and publication are separate",
        "body": "The development preview connects to a sandbox port and updates during code changes. The published website serves a completed deployment. A public development URL does not replace the publication process."
      },
      {
        "title": "The first generated web stack",
        "body": "The proposal uses Vite, React, TypeScript, Tailwind, shadcn/ui, React Router, and supabase-js. This stack produces static website files. Proposed server functions run in Supabase Edge Functions."
      },
      {
        "title": "A selector makes rollback small",
        "body": "An immutable deployment stays unchanged after upload. Rollback selects an earlier deployment. Unpublish and suspension change publication state without a complete file upload. Suspension also records a reason."
      },
      {
        "title": "Why the KV record stays stable",
        "body": "KV stores the domain routing record. The report keeps the deployment identifier out of that record because domain changes use the same contract. current.json selects the deployment separately."
      },
      {
        "title": "The storage paths need one final specification",
        "body": "Section 6.6 proposes shared files at apps/blobs/{sha256}. Section 8 also shows published/{projectId}/d/{deploymentId}/*. These descriptions need one implementation specification. Both require a file list and a separate live selector."
      },
      {
        "title": "File types and cache rules",
        "body": "A MIME content type tells the browser how to interpret a file. JavaScript, images, and HTML need the correct types. Content hashes support long cache lifetimes because changed content gets a new identifier."
      },
      {
        "title": "Domains and server code solve different problems",
        "body": "Cloudflare for SaaS handles customer domains. Workers for Platforms runs server code for customer apps in a later phase. The report proposes one Worker per deployment for that later service."
      },
      {
        "title": "Domain shape matters",
        "body": "The report uses one hostname level for a deployment, such as d-123--myapp.wandit.app. It says that the proposed certificate does not cover two levels. The development preview uses a separate domain for isolation."
      },
      {
        "title": "Publication retains existing connections",
        "body": "The deployment records and domain contract remain compatible with V1. The leads SDK sends forms to the existing public leads endpoint. The publish process also adds the configured pixels and badge to dist/index.html."
      },
      {
        "title": "Host comparisons are report claims",
        "body": "The report favors Cloudflare because of its stated transfer costs and existing Wandit infrastructure. It rejects alternatives based on prices and platform limits. Those commercial details require fresh evidence before purchase or launch."
      }
    ],
    "quiz": {
      "question": "What changes when the proposed system publishes a prepared deployment?",
      "options": [
        "current.json selects the prepared deployment.",
        "The live site becomes the development server.",
        "The system deletes every earlier deployment."
      ],
      "answer": 0,
      "explanation": "The proposal uploads the build first. Then a small selector chooses the live deployment."
    },
    "takeaway": "The sandbox prepares the app. The published host serves a fixed deployment to visitors."
  },
  {
    "id": "security",
    "title": "Give each part limited access",
    "subtitle": "The proposal adds boundaries because an AI agent can run commands and encounter hostile text.",
    "group": "Protect and publish",
    "scene": "security",
    "sourceSections": "6.9, 8.2–8.3, 11",
    "sourceAnchor": "6-9-security",
    "steps": [
      {
        "title": "Put the coding agent in its own machine",
        "body": "The proposal places generated code inside an isolated microVM. The coding agent runs as a non-root user with limited permissions.",
        "caption": "A project gets a separate place to run its code."
      },
      {
        "title": "Keep master keys outside",
        "body": "A broker keeps the real model key outside the sandbox. The coding agent receives a short-lived token. The broker limits what that token can request.",
        "caption": "The coding agent gets limited access without the master key."
      },
      {
        "title": "Protect the browser and data",
        "body": "A separate preview domain prevents generated code from sharing the Wandit editor origin. Database policies limit which rows each user can read or change.",
        "caption": "A preview page and a database request face separate access rules."
      },
      {
        "title": "Apply checks before publication",
        "body": "The publish task examines secrets, database access, and suspected phishing. A failure blocks publication. A suspension switch can stop a published app after an abuse report.",
        "caption": "Publication requires security checks, with a separate way to suspend an app."
      }
    ],
    "terms": [
      {
        "term": "MicroVM",
        "definition": "A small virtual machine with its own operating system kernel."
      },
      {
        "term": "Non-root user",
        "definition": "A system user without the highest operating system permissions."
      },
      {
        "term": "Prompt injection",
        "definition": "Hostile instructions inside content that the AI reads.",
        "example": "A project file tells the agent to reveal a secret instead of completing your request."
      },
      {
        "term": "Secret",
        "definition": "A private credential that grants access to a service.",
        "example": "A model API key or a payment service key is a secret."
      },
      {
        "term": "Broker",
        "definition": "A trusted service that provides limited access to another service."
      },
      {
        "term": "Scoped token",
        "definition": "A temporary credential with limits on its permitted actions or resources."
      },
      {
        "term": "RLS",
        "definition": "Row-level security: database policies that control access to individual rows.",
        "example": "One customer can read that customer's bookings without access to other customers' bookings."
      },
      {
        "term": "Phishing",
        "definition": "An attempt to deceive users into giving private information through a false website or message."
      },
      {
        "term": "Anonymous RLS probe",
        "definition": "An access experiment that requests database records without a user login."
      },
      {
        "term": "Inference",
        "definition": "The process through which a model uses input to produce an answer."
      },
      {
        "term": "Public Suffix List",
        "definition": "A list that browsers use to identify boundaries between independent sites.",
        "example": "The proposal requests an entry for the host domain of generated apps."
      },
      {
        "term": "Credential brokering",
        "definition": "A server or network proxy adds the real credential to a permitted request. The sandbox does not receive that credential."
      }
    ],
    "details": [
      {
        "title": "The three new risks",
        "body": "V2 introduces shell commands from an agent. It also manages secrets for customer backends. Later apps can publish server code. Each capability needs its own limits."
      },
      {
        "title": "Network access starts closed",
        "body": "The proposal blocks outgoing network connections by default. It also denies private network ranges. Approved destinations receive limited access through the proposed network rules."
      },
      {
        "title": "The model proxy needs accurate forwarding",
        "body": "The proxy examines the short token and adds the real model key. It enforces a cost limit for the run and user. It must preserve anthropic-beta, anthropic-version, and cache_control for the proposed integration."
      },
      {
        "title": "Public keys and private keys differ",
        "body": "The frontend can contain the public Supabase key under the proposed access policies. A Supabase secret key bypasses RLS. That secret key stays outside generated frontend code and the sandbox."
      },
      {
        "title": "Server tools hold sensitive actions",
        "body": "The proposal injects secrets through a network proxy or server tools. It asks users for restricted Stripe keys. A restricted key permits fewer operations than a full account key."
      },
      {
        "title": "The preview needs its own origin",
        "body": "An origin combines a scheme, host, and port. The proposal gives each project and run a separate preview origin. A signed token controls entry. The preview proxy also sets a cookie for later requests."
      },
      {
        "title": "The iframe has additional rules",
        "body": "The preview needs allow-same-origin for login sessions. The proposal uses frame-ancestors headers to control embedding. It excludes allow-top-navigation so generated code cannot replace the main page through that permission."
      },
      {
        "title": "The publication checks",
        "body": "Supabase security advisors must report no ERROR result. An anonymous RLS probe examines access without a login. The task also scans for secrets and suspected phishing. These checks reduce specific risks but do not prove that an app has no faults."
      },
      {
        "title": "Protected files and an audit record",
        "body": "A PreToolUse hook rejects changes to .claude, .mcp.json, .git/hooks, and shell configuration files. The proposal adds audit_events and Redis rate limits. Audit events record sensitive actions for later investigation."
      },
      {
        "title": "Three separate cost limits",
        "body": "The model proxy limits money per run. The sandbox limits CPU use and session time. Each backend has a usage limit and a pause mechanism. A separate Anthropic workspace also receives a spend limit."
      },
      {
        "title": "Privacy requires a provider decision",
        "body": "The report discusses inference regions, data retention, and backend regions. These are provider and policy claims that need fresh evidence. The owner must choose the privacy position before external users receive access."
      }
    ],
    "quiz": {
      "question": "Where does the proposed system keep the real model API key?",
      "options": [
        "Inside the generated frontend.",
        "In every sandbox file.",
        "Outside the sandbox, behind the model proxy."
      ],
      "answer": 2,
      "explanation": "The coding agent receives a limited token. The trusted proxy holds the real key and enforces cost limits."
    },
    "takeaway": "Isolation, limited credentials, data policies, and publication checks protect different boundaries."
  },
  {
    "id": "costs",
    "title": "Track cost during each turn",
    "subtitle": "The report proposes a credit process and gives estimates that require real measurements.",
    "group": "Protect and publish",
    "scene": "money",
    "sourceSections": "6.10, 8.2–8.3, 9, 14",
    "sourceAnchor": "6-10-money",
    "steps": [
      {
        "title": "Reserve credit before the run",
        "body": "The API examines the balance and project limits. It reserves part of the balance for the requested work.",
        "caption": "A credit hold sets aside money before the task starts."
      },
      {
        "title": "Record use during the run",
        "body": "The task receives usage events as the agent runs. It records checkpoint debits after groups of steps. Limits can stop further spending.",
        "caption": "Cost records grow during the task, not only at the end."
      },
      {
        "title": "Calculate the final charge",
        "body": "The server calculates charges from token counts and its price table. It settles the hold against the calculated charge.",
        "caption": "The final charge uses measured usage and a controlled price table."
      },
      {
        "title": "Show the receipt",
        "body": "The user sees the recorded charge after the turn. Backend access and mobile preview minutes have separate plan allowances.",
        "caption": "AI work, backend access, and mobile preview have different cost controls."
      }
    ],
    "terms": [
      {
        "term": "Token",
        "definition": "A unit of text that a language model reads or produces.",
        "example": "Input and output tokens can have different prices."
      },
      {
        "term": "Credit",
        "definition": "The billing unit that Wandit shows to the user."
      },
      {
        "term": "Credit hold",
        "definition": "A reserved part of the balance for work that has not finished."
      },
      {
        "term": "Checkpoint debit",
        "definition": "A charge record made during a long task."
      },
      {
        "term": "Settle",
        "definition": "Calculate the final charge and resolve the reserved credit hold."
      },
      {
        "term": "Margin",
        "definition": "The part of revenue that remains after the costs included in a calculation.",
        "example": "Different margin calculations can include different costs."
      },
      {
        "term": "Ledger",
        "definition": "A record of balance changes and the reasons for those changes."
      },
      {
        "term": "Entitlement",
        "definition": "A resource allowance included in a plan.",
        "example": "A plan can permit one active backend."
      },
      {
        "term": "Prompt cache",
        "definition": "Stored reusable model input that can reduce repeated input cost."
      }
    ],
    "details": [
      {
        "title": "The SDK estimate does not set the bill",
        "body": "The report says that total_cost_usd is an estimate from the Agent SDK. The proposed billing process uses token counts and the server price table. Usage records also include projectId."
      },
      {
        "title": "The report keeps the existing credit rule",
        "body": "The proposal keeps one credit equal to $0.04. It keeps the existing ledger, reserve, settle, and reconcile process. Reconciliation compares local records with provider usage records."
      },
      {
        "title": "Illustrative message costs",
        "body": "The report estimates $0.14 for a small edit, $0.44 for a typical feature, and $1.40 for a large build. These examples assume its selected model and cache behavior. They are not measured prices for your next request."
      },
      {
        "title": "The plan trade-off",
        "body": "The report estimates about 17 typical messages from a $25 plan with 175 credits. It compares this result with competitor plans and margins. These comparisons are report claims. The owner must choose the price position after real measurements."
      },
      {
        "title": "Illustrative project costs per month",
        "body": "Section 14 estimates about $15 for a landing page and $39 for a web app with a backend. It estimates $43 for a mobile app with a backend. An idle project costs about $0.30 in that example. Actual usage determines actual cost."
      },
      {
        "title": "Backend access and mobile minutes",
        "body": "The report estimates about $10 monthly for an active backend and $0.06 per mobile preview minute. It proposes plan allowances or add-ons for these resources. These vendor prices require fresh evidence."
      },
      {
        "title": "Proposed model controls",
        "body": "The report selects Sonnet 5 at medium effort and a one-hour cache. It proposes about $2 as a Pro turn budget. It limits subagents to one level and three simultaneous agents. Model availability and prices require separate evidence."
      },
      {
        "title": "What the staging measurements answer",
        "body": "The proposal records real step counts and token sizes for two weeks. It also uses 20 real prompts in P0. These measurements determine the credit mapping and actual cache benefit."
      },
      {
        "title": "Platform bills are separate",
        "body": "Section 14 lists fixed bills for Vercel, Cloudflare, Supabase, and later mobile services. It marks the Trigger.dev plan as unverified. These bills exist separately from a single message receipt and need current provider prices."
      },
      {
        "title": "Two cost rules need a final decision",
        "body": "The synthesis records sandbox usage as a billing operation but also proposes included sandbox minutes. Evidence rows can measure included usage without a separate user charge. The report also gives inconsistent idle-stop times of 10 and 20 minutes."
      }
    ],
    "quiz": {
      "question": "Which source does the report choose for the final AI charge?",
      "options": [
        "The SDK cost estimate alone.",
        "Token counts and the server price table.",
        "The number of words in the user message alone."
      ],
      "answer": 1,
      "explanation": "The proposal uses measured token counts. It does not use total_cost_usd as the final billing source."
    },
    "takeaway": "Reserve credit, record usage, settle the charge, and show a receipt. Treat the report prices as estimates."
  },
  {
    "id": "whole-system",
    "title": "See one request become an app",
    "subtitle": "The proposed system gives each service one clear responsibility.",
    "group": "Put the plan together",
    "scene": "system",
    "sourceSections": "6.3, 7, 8, 9",
    "sourceAnchor": "8-the-design",
    "steps": [
      {
        "title": "The browser requests work",
        "body": "You send a message from the project page. The API examines access, reserves credit, and records a turn. It returns the turn identifier immediately.",
        "caption": "The browser requests work, and the API admits and records it."
      },
      {
        "title": "A background task manages the turn",
        "body": "Trigger.dev manages the builder-turn task independently of the browser tab. The task obtains the project sandbox and resumes the harness session.",
        "caption": "The task keeps responsibility for the run after the browser disconnects."
      },
      {
        "title": "The coding agent changes the project",
        "body": "The harness runs the coding agent inside the sandbox. The preview shows the development server. Redis carries live progress to the browser.",
        "caption": "The agent changes files while the browser shows progress and the preview."
      },
      {
        "title": "The task records the result",
        "body": "The task saves a code version and settles the credit hold. The message records usage and the commit identifier. Publication remains a separate task.",
        "caption": "A finished chat turn creates a code version without automatic publication."
      }
    ],
    "terms": [
      {
        "term": "API",
        "definition": "An interface through which one program requests an action or data from another program."
      },
      {
        "term": "Harness",
        "definition": "The system that gives the coding agent tools, instructions, and a work process."
      },
      {
        "term": "Adapter",
        "definition": "Code that connects one interface to a different implementation.",
        "example": "A sandbox adapter connects the harness to a sandbox provider."
      },
      {
        "term": "Queue",
        "definition": "A list of tasks that wait for permission to run."
      },
      {
        "term": "Export",
        "definition": "A way to transfer a project or its data to a destination outside Wandit."
      },
      {
        "term": "CI",
        "definition": "Continuous integration: automated checks or deployment tasks after code changes."
      },
      {
        "term": "Project type",
        "definition": "The web or mobile choice that the proposal fixes at project creation."
      }
    ],
    "details": [
      {
        "title": "The service roles stay stable",
        "body": "Railway hosts the NestJS API. Trigger.dev manages background tasks. The sandbox runs project tools and development servers. Redis carries live events and locks. Cloudflare and R2 serve published web files. Supabase provides proposed customer backends."
      },
      {
        "title": "The preferred agent integration",
        "body": "The proposal selects AI SDK v7 HarnessAgent with a Claude Code adapter. The direct Claude Agent SDK is its fallback. The harness receives every message, including questions. V2 removes the handoff between the V1 Brain and V1 Builder."
      },
      {
        "title": "Wandit instructions move into the project template",
        "body": "The proposal places design worlds, brief rules, and project instructions in CLAUDE.md and skills. Host tools provide ask_user and generate_image. Wandit tools that spend money or publish require approval."
      },
      {
        "title": "Provider choices remain replaceable",
        "body": "The report selects Vercel Sandbox first and keeps a SandboxProvider interface. Cloudflare Sandbox is the second candidate, with E2B as another option. The proposed change requires an adapter and successful experiments."
      },
      {
        "title": "The model access route needs an experiment",
        "body": "The report proposes a thin Wandit proxy before Vercel AI Gateway. It cites existing V1 usage reconciliation as a reason. It marks Cloudflare AI Gateway header and cache behavior as unverified."
      },
      {
        "title": "Generated app data stays separate",
        "body": "The proposed backend is one Supabase project per app, created only on first need. The proposal uses Supabase Auth, tenant email credentials, and restricted payment keys. Database-only apps can use a later Neon alternative."
      },
      {
        "title": "User choices remain visible",
        "body": "The proposal fixes web or mobile at project creation. Web templates include Arabic, French, and right-to-left layouts. Later export features provide GitHub access and backend ownership transfer. The report conflicts on the first delivery date for backend export."
      },
      {
        "title": "Existing V1 functions retain their contracts",
        "body": "V1 projects keep their engine. Existing leads, domains, media storage, and connector contracts remain available. A later one-way upgrade creates a V2 project from V1 HTML. It does not force every V1 project to migrate."
      },
      {
        "title": "The report is a synthesis, not a completed review",
        "body": "Three agents wrote separate proposals from different priorities. The report says that they agreed on 11 of 15 blocks. Judge and critic runs failed three times with API 529 overload errors. The main agent produced the synthesis."
      },
      {
        "title": "What the report finds in other app builders",
        "body": "Section 6.3 describes a common shape across the examined products. A coding agent changes files, and a development server supplies a preview. Versions preserve changes, and a publish action releases the result. The report uses this comparison to guide the proposed V2 design."
      },
      {
        "title": "Three ways to supply an app backend",
        "body": "A platform can rent a managed backend for each app. It can build and operate its own backend system. It can also connect an account that the user already owns. The report chooses the managed Supabase path for Wandit."
      },
      {
        "title": "Different places to run the tools",
        "body": "The report compares cloud virtual machines, containers, and development environments inside the browser. These choices provide different isolation and runtime features. The report selects a cloud sandbox that can run its chosen coding harness. Browser-only execution does not meet that proposed requirement."
      },
      {
        "title": "Lessons from the market comparison",
        "body": "The report favors a protected preview, saved versions, and an export path. It fixes web or mobile at project creation. It also uses publish checks to detect open database access. Competitor capabilities and prices in the source remain dated research claims."
      }
    ],
    "quiz": {
      "question": "Which component runs the project commands and development server?",
      "options": [
        "The customer browser alone.",
        "The domain routing record.",
        "The sandbox."
      ],
      "answer": 2,
      "explanation": "The sandbox contains the project files and processes. Other services manage tasks, access, progress, data, and publication."
    },
    "takeaway": "The browser asks, the API admits, the task manages, and the sandbox runs the coding agent."
  },
  {
    "id": "records",
    "title": "Give every result a durable record",
    "subtitle": "The proposal adds V2 database records while existing V1 readers keep their current data.",
    "group": "Put the plan together",
    "scene": "records",
    "sourceSections": "9, 10",
    "sourceAnchor": "10-changes-to-the-database-and-the-environment",
    "steps": [
      {
        "title": "Identify the project and turn",
        "body": "A project record identifies the engine and target platform. A builder_turns record tracks one request and its task status.",
        "caption": "The project owns the work, and a turn records one attempt."
      },
      {
        "title": "Connect records by identifiers",
        "body": "The turn refers to its task, message, and input and output commits. These identifiers connect the records without copying every file into each row.",
        "caption": "References connect the request, its work, and its result."
      },
      {
        "title": "Keep different state in the right place",
        "body": "Sandbox records describe the runtime. Git records describe code versions. Backend records identify the app database.",
        "caption": "A sandbox status, a code version, and a database project are different facts."
      },
      {
        "title": "Protect secrets and preserve V1",
        "body": "Secret records contain encrypted values or references to a secure store. V2 adds its own records. Existing V1 code keeps its current data contract.",
        "caption": "Secrets need protection, and V1 needs compatible records."
      }
    ],
    "terms": [
      {
        "term": "Database row",
        "definition": "One record in a database table.",
        "example": "One builder_turns row describes one coding agent turn."
      },
      {
        "term": "Reference",
        "definition": "An identifier that connects one record to another record or service."
      },
      {
        "term": "Source of truth",
        "definition": "The authoritative record for a particular fact.",
        "example": "Git records code history. The backend database records customer bookings."
      },
      {
        "term": "Encryption",
        "definition": "A process that makes stored data unreadable without the required key."
      },
      {
        "term": "Environment value",
        "definition": "A value that the server reads from its runtime configuration."
      },
      {
        "term": "Feature flag",
        "definition": "A switch that controls whether a feature is available."
      },
      {
        "term": "Additive change",
        "definition": "A change that adds records or fields while existing readers retain their current contract."
      }
    ],
    "details": [
      {
        "title": "Sessions and turns",
        "body": "builder_sessions stores harness resume state per chat. builder_turns records status, requestKey, triggerRunId, and input and output commits. It also records failure information and a Sentry event identifier."
      },
      {
        "title": "Sandbox state",
        "body": "sandbox_sessions records the provider identifier, image, status, preview host, and expiry time. These records describe the runtime. They do not replace code history or customer database data."
      },
      {
        "title": "Code history and build results",
        "body": "app_commits, app_bundles, and app_branches hold version information. app_builds records web builds. mobile_builds records Expo builds. A version record and a build record serve different purposes."
      },
      {
        "title": "Backends and secrets",
        "body": "app_backends identifies one proposed Supabase project per V2 project. It records the backend reference, region, and status. project_secrets stores encrypted values or an external reference. It never stores secrets as plain text."
      },
      {
        "title": "Cost and accountability",
        "body": "project_cost_caps records limits for project costs. audit_events records sensitive actions. ai_usage_events gains projectId and the new billing operation names."
      },
      {
        "title": "Changes to existing tables",
        "body": "projects gains engine, targetPlatform, and framework. deployments gains kind, a build prefix, a file count, and bytes. messages gains a turn reference. product_settings gains v2BuilderEnabled. V2 app projects never insert an artifacts row."
      },
      {
        "title": "Core runtime configuration",
        "body": "V2_BUILDER_ENABLED controls module availability. VERCEL_SANDBOX_TOKEN grants sandbox access. ANTHROPIC_API_KEY belongs to the model proxy. LLM_PROXY_SIGNING_KEY protects the short tokens. The proposal makes these values optional at boot and examines them when an operation needs them."
      },
      {
        "title": "Backend and preview configuration",
        "body": "SUPABASE_PLATFORM_TOKEN and SUPABASE_PLATFORM_ORG_ID identify platform access and ownership. APP_SECRETS_ENCRYPTION_KEY protects stored secrets. PREVIEW_DOMAIN names the separate preview domain. PREVIEW_TOKEN_SIGNING_KEY protects preview access tokens."
      },
      {
        "title": "Publication and later services",
        "body": "CLOUDFLARE_V2_DEPLOY_TOKEN supports publication. EXPO_TOKEN and APPETIZE_API_TOKEN support mobile services. RESEND_PLATFORM_API_KEY supports email. A missing optional value must not prevent V1 from starting."
      },
      {
        "title": "The ownership boundary needs precise keys",
        "body": "Project identifiers connect turns, versions, backends, builds, and cost records. The proposal adds workspace context to API requests. Each operation must enforce that ownership boundary. A valid record identifier alone does not grant access."
      }
    ],
    "quiz": {
      "question": "Which record holds the bookings that customers create inside a generated app?",
      "options": [
        "The generated app's backend database.",
        "The sandbox expiry record.",
        "The Git commit identifier."
      ],
      "answer": 0,
      "explanation": "Customer records belong to the app backend. Runtime records and Git history describe different parts of the system."
    },
    "takeaway": "Each record has a clear purpose. References connect the work without mixing code, runtime state, secrets, and customer data."
  },
  {
    "id": "rollout",
    "title": "Deliver the system in usable phases",
    "subtitle": "The report gives an estimated sequence, with staging checks before wider access.",
    "group": "Put the plan together",
    "scene": "rollout",
    "sourceSections": "8.2–8.3, 11",
    "sourceAnchor": "11-the-phases",
    "steps": [
      {
        "title": "Resolve the uncertain foundations",
        "body": "P0 uses experiments to examine the runtime, proxy, costs, and provider access. The results determine which integrations can support the coding agent.",
        "caption": "Experiments come before detailed implementation tickets."
      },
      {
        "title": "Deliver a web editor and host",
        "body": "P1 gives internal users a V2 web editor in staging. P2 adds publication and security controls for the first external users.",
        "caption": "A usable V2 web editor arrives before the full backend product."
      },
      {
        "title": "Add data and mobile support",
        "body": "P3 adds the Cloud tab and app backends. P4 adds the first mobile experience. P5 adds a device preview in the browser on demand.",
        "caption": "Backend and mobile features extend the working web product."
      },
      {
        "title": "Expand after the first product passes its checks",
        "body": "P6 adds advanced features and wider access. P7 adds Wandit's own device infrastructure. Feature flags control access throughout the rollout.",
        "caption": "Later infrastructure follows evidence from the earlier phases."
      }
    ],
    "terms": [
      {
        "term": "Phase",
        "definition": "A group of changes that ends with a usable result."
      },
      {
        "term": "Staging",
        "definition": "A separate environment for checks before production access."
      },
      {
        "term": "Production",
        "definition": "The environment that serves real users."
      },
      {
        "term": "Feature flag",
        "definition": "A switch that controls whether a feature is available."
      },
      {
        "term": "Dependency",
        "definition": "A condition or earlier result that another task needs."
      },
      {
        "term": "Exit condition",
        "definition": "The observable result that defines completion for a task or experiment."
      },
      {
        "term": "Engineer-week",
        "definition": "An estimate of one engineer's work for one week.",
        "example": "This measure does not guarantee a calendar delivery date."
      }
    ],
    "details": [
      {
        "title": "P0 · 3 estimated weeks · Evidence",
        "body": "P0 examines the harness, sandbox access, ports, resume behavior, abort behavior, cache use, and costs. It requests provider answers and a preview domain. It also corrects Redis location, CI gaps, Worker deployment checks, and the staging same-site error."
      },
      {
        "title": "P1 · 9 estimated weeks · Internal web editor",
        "body": "P1 adds the V2 module, contracts, tables, task, event stream, cancellation, and message queue. It adds the sandbox image, template, tools, and protected preview. Versions, restoration, file views, and cost receipts complete the internal staging experience."
      },
      {
        "title": "P2 · 4 estimated weeks · Publication",
        "body": "P2 adds build publication, file delivery, rollback, unpublish, and the leads SDK. It adds network rules, protected paths, secret scans, rate limits, and audit records. It also adds phishing checks and suspension. The report describes the result as Lovable without Cloud."
      },
      {
        "title": "P3 · 7 estimated weeks · App backends",
        "body": "P3 adds backend creation, secret records, server tools, and Cloud tab panels. It adds email domains, payment credentials, login redirects, RLS probes, and advisors. It also adds pause processes and backend plan allowances. The report targets Lovable Cloud parity for web."
      },
      {
        "title": "P4 · 4 estimated weeks · First mobile version",
        "body": "P4 adds an Expo template and a fixed mobile project type. It connects Metro through the preview proxy. A phone frame shows Expo web, and a QR code opens the phone experience. EAS builds support internal distribution and TestFlight."
      },
      {
        "title": "P5 · 3 estimated weeks · Browser device",
        "body": "P5 adds a Wandit preview app with expo-dev-client. It adds simulator and APK builds. Appetize provides a device in the browser on demand. Plan allowances limit preview minutes."
      },
      {
        "title": "P6 · 8 estimated weeks · Advanced features",
        "body": "P6 adds branches per chat, fork previews, AI merge, and GitHub export followed by two-way sync. It includes backend ownership transfer, Vercel export, server apps, and Stripe Connect. It also includes V1 upgrade, click-to-target, history pagination, native client parity, and early access."
      },
      {
        "title": "P7 · 6 estimated weeks plus review · Own devices",
        "body": "P7 proposes Android emulators on KVM with WebRTC. It also proposes a Mac mini pool with serve-sim behind a login proxy. The Apple simulator licensing question needs legal review before this phase."
      },
      {
        "title": "How feature flags protect the rollout",
        "body": "The module loads only with V2_BUILDER_ENABLED=true. New routes use /api/v2 and contracts use packages/contracts/src/v2. A product flag, user flag, and server guard control access. The sequence is development, staging enabled, main disabled, then selected users."
      },
      {
        "title": "Dependencies outside code",
        "body": "The report requires an Anthropic license answer before external users and Supabase terms before P3 pricing. It places the preview domain and Public Suffix List request in P0. P1 needs Cloudflare access. P5 needs Apple and Google developer accounts."
      },
      {
        "title": "The estimates disagree",
        "body": "The summary proposes about 24 engineer-weeks for web parity plus the first mobile phase. The detailed plan gives 23 weeks for P0–P3 and four more for P4. P4–P5 add seven weeks. P6–P7 add 14 weeks plus legal review. The owner needs one reconciled schedule."
      }
    ],
    "quiz": {
      "question": "Why does P0 come before the full V2 implementation?",
      "options": [
        "It publishes every customer project.",
        "It replaces all V1 records.",
        "It produces evidence for uncertain integration choices."
      ],
      "answer": 2,
      "explanation": "The report lists unresolved runtime, cost, and provider questions. P0 experiments determine whether those foundations meet the required conditions."
    },
    "takeaway": "Each phase ends with a usable result. The schedule remains an estimate until dependencies and experiments have answers."
  },
  {
    "id": "decisions",
    "title": "Separate decisions from experiments",
    "subtitle": "The report ends with 12 owner choices, 14 open experiments, and a source list.",
    "group": "Put the plan together",
    "scene": "decisions",
    "sourceSections": "12, 13, 15, 16",
    "sourceAnchor": "12-decisions-that-only-you-can-make",
    "steps": [
      {
        "title": "Mark what the report proposes",
        "body": "A proposal describes a preferred design. It does not prove provider support, price, or legal permission. The report identifies several unverified claims.",
        "caption": "A detailed plan still contains assumptions."
      },
      {
        "title": "Choose the product position",
        "body": "The owner decides the price stance, mobile experience, languages, export timing, and other product choices. These choices change the implementation tickets.",
        "caption": "A product decision selects the result that Wandit wants."
      },
      {
        "title": "Collect evidence for open claims",
        "body": "Each uncertain claim becomes an experiment with an exit condition. Measurements and provider answers determine whether the proposed design can proceed.",
        "caption": "An experiment answers a question that preference alone cannot answer."
      },
      {
        "title": "Create the next implementation tickets",
        "body": "After P0 resolves the runtime questions, the team creates the P1 tickets. The detailed documents provide the evidence behind the report.",
        "caption": "The next plan uses measured results and recorded decisions."
      }
    ],
    "terms": [
      {
        "term": "Proposal",
        "definition": "A suggested design that still needs decisions or evidence."
      },
      {
        "term": "Assumption",
        "definition": "A statement that the plan treats as true before sufficient evidence exists."
      },
      {
        "term": "Experiment",
        "definition": "A small controlled task that answers a specific open question."
      },
      {
        "term": "Exit condition",
        "definition": "The observable result that defines completion for a task or experiment."
      },
      {
        "term": "Primary evidence",
        "definition": "Information from the original system, measurement, provider, or source."
      },
      {
        "term": "Legal review",
        "definition": "An assessment of permission and obligations by a qualified legal professional."
      }
    ],
    "details": [
      {
        "title": "Owner choice 1 · Sandbox provider",
        "body": "The report prefers Vercel because of its stated harness adapter support. This choice adds a runtime vendor. An alternative needs adapter work and separate evidence."
      },
      {
        "title": "Owner choice 2 · Price stance",
        "body": "The owner chooses between a larger margin and a lower user price for comparable work. The report requires two weeks of staging measurements before the credit decision."
      },
      {
        "title": "Owner choice 3 · Backend allowances",
        "body": "The proposal suggests one active backend on Pro and three on Business. It suggests a paid add-on and a pause after seven idle days. These allowances remain product choices."
      },
      {
        "title": "Owner choice 4 · First mobile preview",
        "body": "The report prefers the user's phone for the first phase. A device in the browser adds service costs. The owner chooses the initial experience."
      },
      {
        "title": "Owner choice 5 · Preview domain",
        "body": "The proposal requires a separate preview domain. The owner needs to identify an existing suitable domain or obtain one."
      },
      {
        "title": "Owner choice 6 · Generated UI components",
        "body": "The proposal uses shadcn/ui for web apps. The mobile choice is HeroUI Native with Uniwind, or plain Expo components."
      },
      {
        "title": "Owner choice 7 · Languages",
        "body": "The report proposes Arabic and French from day one. This choice adds template and instruction work in P1. Arabic also needs right-to-left layout support."
      },
      {
        "title": "Owner choice 8 · Data location and retention",
        "body": "The owner chooses the privacy position before external access. The report includes provider claims about inference location and data retention. Those claims need fresh primary evidence."
      },
      {
        "title": "Owner choice 9 · Export timing",
        "body": "The owner chooses early export or P6 delivery. The report calls export available from day one in one section and places it in P6 elsewhere. One decision must resolve that conflict."
      },
      {
        "title": "Owner choice 10 · Default model",
        "body": "The report proposes Sonnet 5 at medium effort and a visible Opus mode. It leaves Fable off by default. Availability, price multipliers, and the final model choice need evidence."
      },
      {
        "title": "Owner choice 11 · Existing V1 projects",
        "body": "The owner can keep V1 projects on V1 indefinitely. A later Upgrade to app feature can create a V2 project. The plan does not require automatic migration."
      },
      {
        "title": "Owner choice 12 · Wandit native client",
        "body": "The owner chooses whether the native Wandit app remains a V1 client initially. The alternative adds the V2 transport later, as part of native client parity."
      },
      {
        "title": "Open experiment 1 · Harness events",
        "body": "P0 must capture all event types during one turn. The changed-file list, checkpoint charges, and stall detection depend on hook events and usage events."
      },
      {
        "title": "Open experiment 2 · External sandbox access",
        "body": "P0 must establish sandbox access from a Railway-like process. The real task host runs outside Vercel, so Vercel-only access is insufficient."
      },
      {
        "title": "Open experiment 3 · Preview port and traffic",
        "body": "P0 must measure a Vite hot-reload session through a second open port. The result must cover connectivity and transferred bytes."
      },
      {
        "title": "Open experiment 4 · Host cancellation",
        "body": "P0 must abort a turn without detach() and examine the proxy log. The result must show whether model requests continue after the host stops."
      },
      {
        "title": "Open experiment 5 · Sandbox image contents",
        "body": "P0 must examine Git and Chromium availability in the image. If the image lacks required tools, the plan needs a custom image."
      },
      {
        "title": "Open experiment 6 · Managed Git service",
        "body": "P0 must create 100 code.storage repositories and push changes after turns. It must measure fetch behavior after resume, latency, and cost. This evidence selects managed Git or the R2 bundle fallback."
      },
      {
        "title": "Open experiment 7 · Prompt cache through the proxy",
        "body": "P0 must measure cacheReadInputTokens on 20 prompts. A nonzero result provides evidence that the cache path works. The report warns that failed caching can increase cost."
      },
      {
        "title": "Open experiment 8 · Anthropic license",
        "body": "P0 requires a written answer from Anthropic sales about the proposed hosted harness and Wandit key. This answer affects permission to launch the service."
      },
      {
        "title": "Open experiment 9 · Supabase capacity and cost",
        "body": "The team needs provider answers about organization limits, backend price, and creation time. P3 also requires measurements of real backend creation behavior."
      },
      {
        "title": "Open experiment 10 · Expo Go compatibility",
        "body": "P4 requires a real-phone experiment with the current store Expo Go version. Its supported SDK and loading policy determine the compatible template."
      },
      {
        "title": "Open experiment 11 · Appetize and Metro",
        "body": "P5 requires a trial that connects an Appetize device to the proposed public Metro host. The browser device experience depends on this connection."
      },
      {
        "title": "Open experiment 12 · Trigger.dev plan",
        "body": "P1 requires current evidence for Trigger.dev prices and Realtime connection limits. These details affect the cost of the durable event copy."
      },
      {
        "title": "Open experiment 13 · Cloudflare sandbox behavior",
        "body": "A later provider evaluation must examine the hypervisor and disk behavior. This experiment matters only if the team pursues the Cloudflare sandbox alternative."
      },
      {
        "title": "Open experiment 14 · Apple simulator permission",
        "body": "P7 requires legal review of simulators streamed to customers. The report does not establish that permission."
      },
      {
        "title": "Where the report evidence lives",
        "body": "The source list contains 22 documents: nine V1 inspections, ten research documents, and three proposals. They are under docs/v2/research/. The report identifies docs/v2/V2-ARCHITECTURE-REPORT.md as its source of truth."
      },
      {
        "title": "Review work that did not complete",
        "body": "The judge panel, synthesis file, critic, and gap-fill files did not complete. The report records API 529 overload errors. It says that the workflow can run again later. Those missing reviews cannot count as completed independent evidence."
      },
      {
        "title": "Report conflicts that need one answer",
        "body": "The report gives different sandbox idle times and different total effort estimates. It also differs on managed Git adoption and backend export timing. Harness session scope alternates between chat and project. These conflicts need explicit decisions before implementation."
      },
      {
        "title": "The practical next step",
        "body": "The owner records the 12 choices. Each open experiment gets one ticket with an exit condition. After P0 provides runtime evidence, the team creates the P1 implementation tickets. This guide explains the report rather than proving its vendor claims."
      }
    ],
    "quiz": {
      "question": "The team does not know whether cancellation stops model requests. What resolves this question?",
      "options": [
        "A preference vote about the sandbox logo.",
        "A controlled abort experiment and proxy evidence.",
        "A longer architecture diagram."
      ],
      "answer": 1,
      "explanation": "This is a behavior question. A measured experiment supplies evidence that a product preference cannot supply."
    },
    "takeaway": "Owner choices define the product. Experiments establish whether the proposed implementation can deliver it."
  }
];
