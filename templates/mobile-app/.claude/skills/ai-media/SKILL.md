---
name: ai-media
description: The media routes of the wandit AI gateway - images, speech, transcription, and video. It gives the routes, the body fields, the answers, the error codes, the storage rules, and one complete Edge Function example for each kind. Load it before you build an image, speech, transcription, or video feature.
---

# AI media

`CLAUDE.md` comes first. Its section "AI features" says how to call `enable_ai`, how to check the user,
and how to call the chat route. This skill adds the media routes.

## Rules

- The gateway also makes images, speech, transcripts, and videos. The model and the values of
  each call set its credit cost.
- `mediaModels` of `enable_ai` lists the models of each kind: `image`, `speech`, `transcription`,
  and `video`. The first id of each list is the default. `speechVoices` lists voice ids with a name.
- Each media route is below `WANDIT_AI_GATEWAY_URL` and takes the same `Authorization` header.
- The function sets the model and every value that changes the price: `n`, `size`, `seconds`,
  `resolution`. The client sends only the prompt, the text, or the file. The function caps each one.
- The function checks the user, answers `OPTIONS`, and maps 402 and 429 like the chat example.
- A 503 means that the gateway cannot serve the call now. Show an error, or poll again for a video.
- `invoke` in React Native reads no bytes. So the function stores each image, MP3, and video in
  the private bucket `ai-media` and answers a signed URL. Create the bucket once with `apply_migration`:

```sql
insert into storage.buckets (id, name, public) values ('ai-media', 'ai-media', false)
  on conflict (id) do nothing;
create policy ai_media_read_own on storage.objects for select to authenticated
  using (bucket_id = 'ai-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
```

- The function writes the file with a client on `SUPABASE_SERVICE_ROLE_KEY`, at `<user id>/<random name>`.
  It never takes a bucket or a path from the client. The service role key never leaves the function.
- The function answers the `path` and a signed URL for 1 hour. Save `path` in a table row when the
  app shows the file again. Then make a new URL with
  `supabase.storage.from("ai-media").createSignedUrl(path, 3600)`. The policy allows only the user's own folder.
- Show an image with `expo-image`, play an MP3 with `expo-audio`, and play a video with `expo-video`.

## Images

- `POST <WANDIT_AI_GATEWAY_URL>/images/generations` with JSON `{ model, prompt, n, size }`.
  `prompt` has at most 4000 characters. `n` is 1 to 4. Leave out `size` for the default size.
- A `google/` model takes no image count, so `n` must be 1. When the prompt asks for more images,
  the answer can hold more than one, and each one costs credits. Its `size` is `1K` or `2K`,
  except `google/gemini-2.5-flash-image`, which takes no `size`. Another `n` or `size` answers 400,
  and the message names the allowed values.
- The other image models take no `size`. A `size` on them answers 400.
- A `google/` model can answer 400 with no image, for example when it refuses the prompt.
  That call still costs credits. Ask the user to change the prompt.
- The answer is `{ created, data: [{ b64_json }] }`. Decode the base64 and store the bytes.
  Never send base64 to the client.

Example `supabase/functions/ai-image/index.ts`:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MAX_PROMPT_CHARS = 1000;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: "sign-in" }, { status: 401, headers: corsHeaders });
  const { prompt } = await request.json().catch(() => ({}));
  if (typeof prompt !== "string" || prompt.length === 0 || prompt.length > MAX_PROMPT_CHARS) {
    return Response.json({ error: "input" }, { status: 400, headers: corsHeaders });
  }
  // The function sets the model and `n`. Both change the price.
  const upstream = await fetch(`${Deno.env.get("WANDIT_AI_GATEWAY_URL")}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("WANDIT_AI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-nano-banana-2.1", prompt, n: 1 }),
  });
  if (upstream.status === 402) return Response.json({ error: "credits" }, { status: 402, headers: corsHeaders });
  if (upstream.status === 429) return Response.json({ error: "busy" }, { status: 429, headers: corsHeaders });
  // 400: the model made no image for this prompt. The call still costs credits.
  if (upstream.status === 400) {
    console.error("ai gateway", upstream.status, await upstream.text());
    return Response.json({ error: "prompt" }, { status: 400, headers: corsHeaders });
  }
  const image = upstream.ok ? (await upstream.json()).data?.[0]?.b64_json : undefined;
  if (typeof image !== "string") {
    console.error("ai gateway", upstream.status, upstream.ok ? "no image" : await upstream.text());
    return Response.json({ error: "ai" }, { status: 502, headers: corsHeaders });
  }
  const bytes = Uint8Array.from(atob(image), (char) => char.charCodeAt(0));
  // The models answer PNG, JPEG, or WebP. The first byte tells which.
  const type = bytes[0] === 0x89 ? "png" : bytes[0] === 0xff ? "jpeg" : "webp";
  const path = `${data.user.id}/${crypto.randomUUID()}.${type}`;
  // Only the service role writes the bucket. The path never comes from the client.
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const stored = await admin.storage.from("ai-media").upload(path, bytes, { contentType: `image/${type}` });
  const signed = stored.error ? null : await admin.storage.from("ai-media").createSignedUrl(path, 3600);
  if (!signed?.data) {
    console.error("storage", stored.error?.message ?? signed?.error?.message);
    return Response.json({ error: "storage" }, { status: 500, headers: corsHeaders });
  }
  return Response.json({ path, url: signed.data.signedUrl }, { headers: corsHeaders });
});
```

## Speech (text to speech)

- `POST <WANDIT_AI_GATEWAY_URL>/audio/speech` with JSON `{ model, input, voice }`.
  `input` has at most 10,000 characters. `voice` is an id from `speechVoices`.
- The answer is MP3 bytes. The function stores them in `ai-media` and answers a signed URL.
  The app plays the URL with `expo-audio`.

Example `supabase/functions/ai-speech/index.ts`:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MAX_TEXT_CHARS = 2000;
// Rachel, from `speechVoices` of `enable_ai`.
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: "sign-in" }, { status: 401, headers: corsHeaders });
  const { text } = await request.json().catch(() => ({}));
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_TEXT_CHARS) {
    return Response.json({ error: "input" }, { status: 400, headers: corsHeaders });
  }
  const upstream = await fetch(`${Deno.env.get("WANDIT_AI_GATEWAY_URL")}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("WANDIT_AI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "elevenlabs/eleven-flash-v2.5", input: text, voice: VOICE_ID }),
  });
  if (upstream.status === 402) return Response.json({ error: "credits" }, { status: 402, headers: corsHeaders });
  if (upstream.status === 429) return Response.json({ error: "busy" }, { status: 429, headers: corsHeaders });
  if (!upstream.ok) {
    console.error("ai gateway", upstream.status, await upstream.text());
    return Response.json({ error: "ai" }, { status: 502, headers: corsHeaders });
  }
  const path = `${data.user.id}/${crypto.randomUUID()}.mp3`;
  // Only the service role writes the bucket. The path never comes from the client.
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const stored = await admin.storage.from("ai-media").upload(path, await upstream.blob(), { contentType: "audio/mpeg" });
  const signed = stored.error ? null : await admin.storage.from("ai-media").createSignedUrl(path, 3600);
  if (!signed?.data) {
    console.error("storage", stored.error?.message ?? signed?.error?.message);
    return Response.json({ error: "storage" }, { status: 500, headers: corsHeaders });
  }
  return Response.json({ path, url: signed.data.signedUrl }, { headers: corsHeaders });
});
```

## Transcription (speech to text)

- `POST <WANDIT_AI_GATEWAY_URL>/audio/transcriptions` with multipart form data: the field `file`
  (one audio file) and the field `model`. The order of the two fields is free.
- Formats: WAV, M4A or MP4 (AAC), WebM with Opus, and Ogg with Opus. At most 15 MiB and 5 minutes.
  MP3 and raw AAC answer 400.
  A larger file answers 413. Another format, or a longer file, answers 400. Stop a recording at 4 minutes.
- The gateway reads the format from the content type of the `file` part, not from the file name.
  The type must start with `audio/`. Always send the `type` field of the file.
- The app records with `expo-audio`, which writes an M4A file. It sends
  `{ uri: recorder.uri, name: "voice.m4a", type: "audio/mp4" }` under `file` in a `FormData` with `invoke`.
  Never set `Content-Type` for a `FormData`: `fetch` adds the multipart boundary.
- The answer is `{ text, language, duration }`. `language` and `duration` can be `null`.

Example `supabase/functions/ai-transcribe/index.ts`:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
// 10 MiB stays below the gateway limit of 15 MiB.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: "sign-in" }, { status: 401, headers: corsHeaders });
  const form = await request.formData().catch(() => null);
  const audio = form?.get("file");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES || !audio.type.startsWith("audio/")) {
    return Response.json({ error: "input" }, { status: 400, headers: corsHeaders });
  }
  const upstreamForm = new FormData();
  upstreamForm.append("model", "elevenlabs/scribe-v2");
  // The `File` keeps the content type of the app part. The gateway reads the format from it.
  upstreamForm.append("file", audio, audio.name || "voice.m4a");
  // No Content-Type header: `fetch` adds the multipart boundary.
  const upstream = await fetch(`${Deno.env.get("WANDIT_AI_GATEWAY_URL")}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("WANDIT_AI_API_KEY")}` },
    body: upstreamForm,
  });
  if (upstream.status === 402) return Response.json({ error: "credits" }, { status: 402, headers: corsHeaders });
  if (upstream.status === 429) return Response.json({ error: "busy" }, { status: 429, headers: corsHeaders });
  if (!upstream.ok) {
    console.error("ai gateway", upstream.status, await upstream.text());
    // 400: the gateway cannot read the format, or the audio is longer than 5 minutes.
    const error = upstream.status === 400 ? "audio" : "ai";
    return Response.json({ error }, { status: upstream.status === 400 ? 400 : 502, headers: corsHeaders });
  }
  const { text } = await upstream.json();
  return Response.json({ text }, { headers: corsHeaders });
});
```

## Video

- A video is a job. An Edge Function must answer in 150 seconds, so it never waits for the video.
- Start: `POST <WANDIT_AI_GATEWAY_URL>/videos` with JSON
  `{ model, prompt, seconds, resolution, aspect_ratio, audio }`. `prompt` has at most 2000 characters.
  - Each model takes its own lengths in whole seconds and its own resolutions:
    - `heygen/heygen-video-1` (the default): 5 to 14 seconds; `480p`, `768p`, `1080p`, or `2k`.
    - `bytedance/seedance-2.5-flash`: 4 to 15 seconds; `480p` or `720p`.
    - `bytedance/seedance-2.5`: 4 to 15 seconds; `480p`, `720p`, or `1080p`.
    - `minimax/minimax-h3-max`: 5 to 15 seconds; `480p` or `768p`.
  - Another length or resolution answers 400. `resolution` defaults to `480p`.
    `aspect_ratio`: `16:9` (default) or `9:16`.
  - Only the two Seedance models take `audio: true`. HeyGen and MiniMax decide the sound,
    and `audio: true` on them answers 400.
  - A prompt for a Seedance model cannot contain `--`. The call answers 400.
  - The model, `seconds`, and `resolution` set the price. Audio does not change it.
    Keep the default model and `480p` unless the user asks for more. Another model or `1080p` costs many times more credits.
    The credits are held at the start.
- The answer is `{ id, status: "queued", model, seconds }`. The function gives `id` to the app.
- A completed video costs credits also when no client reads it. So the app saves the job id in a
  table row before the first poll. After a restart, the app reads the row and continues the polls.
- The app calls the function every 5 seconds with the `id`, with `refetchInterval` of React Query.
  The function calls `GET <WANDIT_AI_GATEWAY_URL>/videos/status?id=<encodeURIComponent(id)>`.
  The answer `status` is `in_progress`, `completed`, `failed`, or `expired`.
- `failed` and `expired` cost no credits and give no video. Stop the polls and tell the user.
  A 429, a 502, or a 503 on a poll is not an end: wait 10 seconds, then poll again.
  A 404 is an end: the job id is not valid or is older than 24 hours.
- The polls have their own rate window: 120 status and content calls per minute for each project.
- On `completed`, the function calls `GET <WANDIT_AI_GATEWAY_URL>/videos/content?id=<encodeURIComponent(id)>`
  once. It stores the bytes in `ai-media` and answers a signed URL. Play it with `expo-video`.
- The content route answers 409 before `completed` and for a failed job, and 410 when the job expired.
  A job id that is changed, or that belongs to another project, answers 404 on both routes.

Example `supabase/functions/ai-video/index.ts`. The app sends `{ action: "start", prompt }` and
saves the `jobId` of the answer in a table row. Then it sends `{ action: "status", jobId }` every
5 seconds until `status` is not `in_progress`:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MAX_PROMPT_CHARS = 1000;
// The gateway accepts a job id of at most 8192 characters.
const MAX_JOB_ID_CHARS = 8192;
const gatewayUrl = Deno.env.get("WANDIT_AI_GATEWAY_URL");
const gatewayHeaders = { Authorization: `Bearer ${Deno.env.get("WANDIT_AI_API_KEY")}`, "Content-Type": "application/json" };

// 402, 429, and 503 go to the app. On a poll, a 502 is a short upstream problem, so it is a retry too.
// Any other refusal (also a 404 for an old job id) is an AI error, not a sign-in error.
async function aiFailure(upstream: Response, isPoll = false) {
  if (upstream.status === 402) return Response.json({ error: "credits" }, { status: 402, headers: corsHeaders });
  if (upstream.status === 429) return Response.json({ error: "busy" }, { status: 429, headers: corsHeaders });
  // 503, or a 502 on a poll: the call can work later. A poll tries again in 10 seconds.
  if (upstream.status === 503 || (isPoll && upstream.status === 502)) {
    return Response.json({ error: "retry" }, { status: 503, headers: corsHeaders });
  }
  console.error("ai gateway", upstream.status, await upstream.text());
  return Response.json({ error: "ai" }, { status: 502, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: "sign-in" }, { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => ({}));
  if (body?.action === "start") {
    if (typeof body.prompt !== "string" || body.prompt.length === 0 || body.prompt.length > MAX_PROMPT_CHARS) {
      return Response.json({ error: "input" }, { status: 400, headers: corsHeaders });
    }
    // The function sets the model, the length, and the size. Each one changes the price.
    const upstream = await fetch(`${gatewayUrl}/videos`, {
      method: "POST",
      headers: gatewayHeaders,
      body: JSON.stringify({ model: "heygen/heygen-video-1", prompt: body.prompt, seconds: 5, resolution: "480p", aspect_ratio: "9:16" }),
    });
    if (!upstream.ok) return aiFailure(upstream);
    const job = await upstream.json();
    return Response.json({ jobId: job.id, status: "in_progress" }, { headers: corsHeaders });
  }
  if (body?.action !== "status" || typeof body.jobId !== "string" || body.jobId.length === 0 || body.jobId.length > MAX_JOB_ID_CHARS) {
    return Response.json({ error: "input" }, { status: 400, headers: corsHeaders });
  }
  const id = encodeURIComponent(body.jobId);
  const status = await fetch(`${gatewayUrl}/videos/status?id=${id}`, { headers: gatewayHeaders });
  if (!status.ok) return aiFailure(status, true);
  const job = await status.json();
  if (job.status !== "completed") return Response.json({ status: job.status }, { headers: corsHeaders });
  const content = await fetch(`${gatewayUrl}/videos/content?id=${id}`, { headers: gatewayHeaders });
  if (content.status === 410) return Response.json({ status: "expired" }, { headers: corsHeaders });
  if (!content.ok) return aiFailure(content, true);
  // A cut download throws. The job stays completed, so the next poll reads the video again.
  const video = await content.blob().catch(() => null);
  if (!video) return Response.json({ error: "retry" }, { status: 503, headers: corsHeaders });
  // The file name comes from the job id. A second poll after `completed` overwrites the same file.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.jobId));
  const name = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const path = `${data.user.id}/${name}.mp4`;
  // Only the service role writes the bucket. The path never comes from the client.
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const stored = await admin.storage.from("ai-media").upload(path, video, { contentType: "video/mp4", upsert: true });
  const signed = stored.error ? null : await admin.storage.from("ai-media").createSignedUrl(path, 3600);
  if (!signed?.data) {
    console.error("storage", stored.error?.message ?? signed?.error?.message);
    return Response.json({ error: "storage" }, { status: 500, headers: corsHeaders });
  }
  return Response.json({ status: "completed", path, url: signed.data.signedUrl }, { headers: corsHeaders });
});
```
