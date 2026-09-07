"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { HTTPError } from "ky";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import type { MessageAttachment } from "../service/chat.service";
import {
  MAX_RECORDING_BYTES,
  speakableText,
  synthesizeSpeech,
  transcribeAttachment,
} from "../service/speech.service";

/**
 * Whether this deployment can speak or listen at all.
 *
 * There is no capability endpoint to ask, and there does not need to be: the
 * two speech routes answer 503 when the deployment has not configured a
 * provider, so the first refusal is the answer. It is remembered per workspace
 * in a module-level store rather than in component state because every assistant
 * message mounts its own read-aloud button — one refusal has to silence all of
 * them, not just the one that was clicked.
 */
type SpeechCapability = "transcription" | "synthesis";

const unavailable = new Set<string>();
const availabilityListeners = new Set<() => void>();

function capabilityKey(capability: SpeechCapability, workspaceId: string) {
  return `${capability}:${workspaceId}`;
}

function subscribeToAvailability(listener: () => void) {
  availabilityListeners.add(listener);
  return () => {
    availabilityListeners.delete(listener);
  };
}

/** True when this was the first refusal, so the explanation is shown once. */
function markUnavailable(
  capability: SpeechCapability,
  workspaceId: string,
): boolean {
  const key = capabilityKey(capability, workspaceId);
  if (unavailable.has(key)) return false;
  unavailable.add(key);
  for (const listener of availabilityListeners) listener();
  return true;
}

function isSpeechUnavailable(error: unknown): boolean {
  return error instanceof HTTPError && error.response.status === 503;
}

/**
 * Optimistic until proven otherwise: a control hidden on a guess is worse than
 * one that is refused once and then disappears. The server snapshot agrees with
 * the first client render, so nothing rehydrates differently.
 */
export function useSpeechAvailable(
  capability: SpeechCapability,
  workspaceId: string,
): boolean {
  const snapshot = useCallback(
    () => !unavailable.has(capabilityKey(capability, workspaceId)),
    [capability, workspaceId],
  );
  return useSyncExternalStore(subscribeToAvailability, snapshot, () => true);
}

/**
 * The container the browser will actually record in.
 *
 * Chrome emits webm/opus and Safari emits mp4; neither is negotiable, so the
 * list is asked rather than assumed. `undefined` leaves the choice to the
 * browser, and the recorder's own `mimeType` is read back afterwards.
 */
const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickRecordingMimeType(): string | undefined {
  return RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Support cannot change while the page is open, so there is nothing to watch. */
function subscribeToNothing(): () => void {
  return () => {};
}

/** Neither API exists during SSR, and `getUserMedia` needs a secure context. */
function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

function recordingFileName(mimeType: string): string {
  const container = mimeType.split(";")[0];
  const extension =
    container === "audio/mp4"
      ? "m4a"
      : container === "audio/ogg"
        ? "ogg"
        : container === "audio/wav"
          ? "wav"
          : "webm";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `recording-${stamp}.${extension}`;
}

/**
 * What went wrong reaching the microphone, in words that say what to do about
 * it. A blocked permission is the common case and it is not recoverable from
 * inside the page — only the browser's own site settings can undo it.
 */
function microphoneMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it for this site in your browser's settings, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The microphone is in use by another application.";
  }
  // Raised by `MediaRecorder` rather than by `getUserMedia`: the microphone was
  // reached and no container this browser offers could be recorded in.
  if (name === "NotSupportedError") {
    return "This browser cannot record audio in a format the server accepts.";
  }
  return "The microphone could not be started.";
}

/**
 * The clip is capped where transcription actually binds: the backend refuses
 * anything longer, and ten minutes of audio is ten minutes of a CPU sidecar.
 */
const MAX_RECORDING_SECONDS = 600;

export type VoiceInputStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "transcribing";

/**
 * Speaking a question instead of typing it.
 *
 * The clip is uploaded as an ordinary attachment — the same endpoint an image
 * goes through — and then transcribed, and the transcript is handed back to the
 * composer as editable text rather than sent. Nothing is asked on the user's
 * behalf: a transcript is a machine's reading of what someone said, and the
 * person who said it is the one who gets to correct it.
 */
export function useVoiceInput({
  workspaceId,
  attach,
  onTranscript,
  onTranscribed,
}: {
  workspaceId: string;
  /** Uploads the clip and resolves with it, or null when the upload failed. */
  attach: (file: File) => Promise<MessageAttachment | null>;
  onTranscript: (text: string) => void;
  /**
   * The clip now has a transcript, so it may be sent with the question. Only
   * then: a recording the server could not transcribe would be refused on the
   * send and take the whole turn with it.
   */
  onTranscribed?: (attachmentId: string) => void;
}) {
  const [status, setStatus] = useState<VoiceInputStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  // Read through a store rather than in render: `MediaRecorder` does not exist
  // on the server, so the server snapshot says "no" and the client corrects it
  // after hydration instead of the two disagreeing about the same markup.
  const supported = useSyncExternalStore(
    subscribeToNothing,
    isRecordingSupported,
    () => false,
  );
  const available = useSpeechAvailable("transcription", workspaceId);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * Held from the first click until the stream is released.
   *
   * `status` cannot do this job: it only becomes "recording" after the
   * permission prompt has been awaited, so a second click while the prompt is
   * open still reads "idle" — and opens a second microphone that nothing then
   * holds a reference to.
   */
  const startingRef = useRef(false);

  /**
   * Every track is stopped, not just the recorder: a live `MediaStream` keeps
   * the tab's recording indicator lit long after the recording is over, which
   * reads — correctly — as an application still listening.
   */
  const release = useCallback(() => {
    for (const track of recorderRef.current?.stream.getTracks() ?? []) {
      track.stop();
    }
    recorderRef.current = null;
    startingRef.current = false;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const transcribeClip = useCallback(
    async (file: File) => {
      if (file.size > MAX_RECORDING_BYTES) {
        toast.error("That recording is too long", {
          description: `The limit is ${Math.floor(MAX_RECORDING_BYTES / 1024 / 1024)} MB.`,
        });
        setStatus("idle");
        setSeconds(0);
        return;
      }

      setStatus("uploading");
      const attachment = await attach(file);
      // A failed upload has already said so on its own thumbnail.
      if (!attachment) {
        setStatus("idle");
        setSeconds(0);
        return;
      }

      setStatus("transcribing");
      try {
        const transcript = await transcribeAttachment(workspaceId, attachment.id);
        const text = transcript.text.trim();
        onTranscribed?.(attachment.id);
        if (text) {
          onTranscript(text);
        } else {
          toast.info("Nothing could be heard in that recording.");
        }
      } catch (error) {
        // Said once, and then the microphone button is disabled rather than
        // every recording failing the same way in turn.
        if (isSpeechUnavailable(error)) {
          if (markUnavailable("transcription", workspaceId)) {
            toast.info("Voice input is not enabled on this deployment.", {
              description: "Type your question instead.",
            });
          }
        } else {
          toast.error("The recording could not be transcribed", {
            description: await errorMessage(error),
          });
        }
      } finally {
        setStatus("idle");
        setSeconds(0);
      }
    },
    [attach, onTranscript, onTranscribed, workspaceId],
  );

  const stop = useCallback(() => {
    cancelledRef.current = false;
    // The clip is assembled in `onstop`, which is also where the stream is
    // released — one path for both ending and abandoning a recording.
    recorderRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || status !== "idle" || !isRecordingSupported()) return;
    startingRef.current = true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      startingRef.current = false;
      toast.error("The microphone could not be used", {
        description: microphoneMessage(error),
      });
      return;
    }

    const preferred = pickRecordingMimeType();
    let recorder: MediaRecorder;
    try {
      // Inside the guard with `start()`: Safari refuses a container it cannot
      // encode here rather than when it was asked what it supports, and an
      // unhandled rejection at this point would leave the microphone open with
      // nothing on screen to say so.
      recorder = new MediaRecorder(
        stream,
        preferred ? { mimeType: preferred } : undefined,
      );

      chunksRef.current = [];
      cancelledRef.current = false;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const mimeType = recorder.mimeType || preferred || "audio/webm";
        release();

        if (cancelledRef.current || chunks.length === 0) {
          setStatus("idle");
          setSeconds(0);
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        void transcribeClip(
          new File([blob], recordingFileName(mimeType), { type: mimeType }),
        );
      };

      recorder.start();
    } catch (error) {
      // `release` only knows the stream through the recorder, which may never
      // have been constructed, so the tracks are stopped from the stream itself.
      for (const track of stream.getTracks()) track.stop();
      release();
      toast.error("The recording could not be started", {
        description: microphoneMessage(error),
      });
      return;
    }

    setSeconds(0);
    setStatus("recording");

    // Counted from the wall clock rather than by adding one per tick, so a
    // throttled background tab shows how long it really recorded.
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      const value = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(value);
      if (value >= MAX_RECORDING_SECONDS && recorder.state === "recording") {
        recorder.stop();
      }
    }, 1000);
  }, [release, status, transcribeClip]);

  useEffect(
    () => () => {
      // Leaving mid-recording must neither hold the microphone open nor send a
      // clip off to be transcribed for a composer that is no longer there.
      cancelledRef.current = true;
      release();
    },
    [release],
  );

  return {
    status,
    seconds,
    /** False on a browser without `MediaRecorder`, and during SSR. */
    supported,
    /** False once this deployment has answered 503 to a transcribe. */
    available,
    /** A clip is being uploaded or transcribed; the question is not ready yet. */
    busy: status === "uploading" || status === "transcribing",
    start,
    stop,
    cancel,
  };
}

/** Only one answer is read at a time; starting a second stops the first. */
let playingAloud: { token: object; stop: () => void } | null = null;

export type ReadAloudStatus = "idle" | "loading" | "playing";

/**
 * Reading one answer out loud.
 *
 * The audio is generated per request and played from an object URL, which is
 * revoked the moment playback ends or is stopped — a transcript of twenty
 * answers each holding a blob alive is a tab that grows all afternoon.
 */
export function useReadAloud(workspaceId: string, content: string) {
  const [status, setStatus] = useState<ReadAloudStatus>("idle");
  const available = useSpeechAvailable("synthesis", workspaceId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // This hook instance's identity, so it can tell its own playback from the
  // one another message started.
  const tokenRef = useRef({});

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (playingAloud?.token === tokenRef.current) playingAloud = null;

    setStatus("idle");
  }, []);

  const play = useCallback(async () => {
    const text = speakableText(content);
    if (!text) {
      toast.info("There is nothing here to read aloud.");
      return;
    }

    if (playingAloud && playingAloud.token !== tokenRef.current) {
      playingAloud.stop();
    }
    playingAloud = { token: tokenRef.current, stop };

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");

    try {
      const blob = await synthesizeSpeech(workspaceId, text, controller.signal);
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.onended = stop;
      audio.onerror = () => {
        toast.error("The generated audio could not be played.");
        stop();
      };
      audioRef.current = audio;
      setStatus("playing");
      await audio.play();
    } catch (error) {
      if (controller.signal.aborted) return;
      // 503 is the deployment saying it has no voice configured. Said once, and
      // then every read-aloud button goes away rather than failing one by one.
      if (isSpeechUnavailable(error)) {
        if (markUnavailable("synthesis", workspaceId)) {
          toast.info("Read aloud is not enabled on this deployment.");
        }
      } else {
        toast.error("This answer could not be read aloud", {
          description: await errorMessage(error),
        });
      }
      stop();
    }
  }, [content, stop, workspaceId]);

  // Leaving the thread stops the voice and releases the blob behind it.
  useEffect(() => stop, [stop]);

  return { status, available, play, stop };
}
