import { z } from "zod";

import { api } from "@/lib/ky";

/**
 * Speech at the client edge: turning a recording into text, and an answer into
 * audio. Both hang off the workspace, and transcription addresses the very
 * attachment the recording was uploaded as — there is one upload endpoint, and
 * a clip goes through it exactly as an image does.
 */

/** Mirrors the backend cap; a longer body is refused before anything is spoken. */
export const MAX_SYNTHESIS_CHARACTERS = 4_000;

/** What the upload endpoint accepts for a recording, before it stores a byte. */
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024;

/**
 * Transcription runs roughly in real time against a CPU-only sidecar, so a
 * several-minute clip outlives the shared client's 60s ceiling by a wide margin.
 */
const TRANSCRIBE_TIMEOUT_MS = 600_000;

/** Synthesis is generated in one pass and holds the request open while it is. */
const SYNTHESIZE_TIMEOUT_MS = 120_000;

/**
 * `segments` and the rest of the response are deliberately not modelled: the
 * composer wants the text, and a field this client never reads is a field it
 * should not have an opinion about.
 */
export const transcriptSchema = z.object({
  attachmentId: z.string(),
  /**
   * Untrusted. A model read this out of a recording, so it lands in the
   * composer as editable text for a person to approve — never as something the
   * app acts on by itself.
   */
  text: z.string(),
  language: z.string().nullable().default(null),
  durationSec: z.number().nullable().default(null),
  /** True when the transcript was already on the row, so nothing was charged. */
  cached: z.boolean().default(false),
});

export type Transcript = z.infer<typeof transcriptSchema>;

export async function transcribeAttachment(
  workspaceId: string,
  attachmentId: string,
  language?: string,
): Promise<Transcript> {
  const response = await api.post(
    `workspaces/${workspaceId}/attachments/${attachmentId}/transcribe`,
    {
      json: language ? { language } : {},
      timeout: TRANSCRIBE_TIMEOUT_MS,
    },
  );
  return transcriptSchema.parse(await response.json());
}

/**
 * Speak a piece of text.
 *
 * The response is audio bytes with a real content type, which is why this hands
 * back a `Blob`: the caller makes an object URL out of it and plays it, and the
 * blob's own type is what tells the element how to decode it.
 */
export async function synthesizeSpeech(
  workspaceId: string,
  text: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await api.post(`workspaces/${workspaceId}/speech`, {
    json: { text },
    signal,
    timeout: SYNTHESIZE_TIMEOUT_MS,
  });
  return response.blob();
}

/**
 * What the voice should actually say.
 *
 * A stored answer is markdown carrying `[[n]]` citation markers, and a
 * synthesiser reads both literally — "hash hash Sources", "bracket bracket one".
 * Code fences go entirely: nobody wants a shell script read out, and it is the
 * one part of an answer that is meant to be looked at rather than heard.
 */
export function speakableText(content: string): string {
  const spoken = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[\[\d+\]\]/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Truncated rather than refused: the server refuses a longer body outright,
  // and hearing the first part of a long answer is worth more than a message
  // saying it was too long to read.
  return spoken.slice(0, MAX_SYNTHESIS_CHARACTERS);
}
