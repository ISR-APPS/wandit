import { z } from "zod";

// Field primitives shared by every v1 contract so scalars cross the wire the
// same way everywhere: uuid ids (exception: chat message ids are plain
// strings — the AI SDK generates them client/worker-side) and ISO-8601 UTC
// timestamps (`Date#toISOString` on the server).

export const uuidSchema = z.uuid();

export const isoDateTimeSchema = z.iso.datetime();
