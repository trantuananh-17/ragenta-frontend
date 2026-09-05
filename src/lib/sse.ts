/**
 * A minimal Server-Sent Events reader over `fetch`.
 *
 * `EventSource` cannot be used for chat: the turn is a POST with a JSON body,
 * and EventSource only issues GETs. The backend answers the same SSE framing
 * either way (`event:` + `data:` lines separated by a blank line), so this
 * parses that and yields one decoded frame at a time.
 *
 * Everything that can refuse a turn is refused *before* the stream opens, so a
 * non-OK response here is a normal error with a JSON body — not an error frame.
 */
export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Frames are separated by a blank line. Tolerant of `\r\n` as well as `\n`:
 * the backend writes `\n`, but a reverse proxy that normalises line endings
 * would otherwise leave every frame unterminated and the answer would arrive as
 * nothing at all.
 */
const FRAME_SEPARATOR = /\r?\n\r?\n/;

export async function* readSse(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<SseFrame> {
  const body = response.body;
  if (!body) return;

  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;

      // A partial frame stays in the buffer until its terminator arrives — a
      // chunk boundary lands mid-frame often enough that not doing this drops
      // tokens.
      let match = FRAME_SEPARATOR.exec(buffer);
      while (match) {
        const raw = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const frame = parseFrame(raw);
        if (frame) yield frame;
        match = FRAME_SEPARATOR.exec(buffer);
      }
    }

    // A last frame whose terminating blank line never arrived — the connection
    // closed between the final `data:` and its `\n\n`. Dropping it would lose a
    // whole frame, and if that frame is `done` the caller never learns the turn
    // finished and the composer stays stuck in "answering".
    const trailing = parseFrame(buffer);
    if (trailing) yield trailing;
  } finally {
    reader.cancel().catch(() => {
      // The consumer stopped reading; the connection is already going away.
    });
  }
}

function parseFrame(raw: string): SseFrame | null {
  let event = "message";
  const data: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }

  if (data.length === 0) return null;
  return { event, data: data.join("\n") };
}
