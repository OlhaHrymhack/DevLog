import { useEffect, useRef, useState } from "react";
import { VoiceTaskDraftResponseSchema, type VoiceTaskDraft } from "@/entities/task";
import { ApiError, fetchJson } from "@/shared/api/http";
import { VOICE_AUDIO_MAX_BYTES, VOICE_RECORDING_MAX_MS, VOICE_AUDIO_EXTENSIONS } from "@/shared/lib/voiceTaskRecording";
import { toLocalDateTime } from "./localDateTime";

type VoicePhase = "idle" | "requesting" | "recording" | "processing";
type RecordingSession = {
  controller: AbortController;
  recorder?: MediaRecorder;
  stream?: MediaStream;
  timer?: ReturnType<typeof setTimeout>;
};

const stopTracks = (stream?: MediaStream) => stream?.getTracks().forEach((track) => track.stop());

const stopRecording = (session?: RecordingSession) => {
  clearTimeout(session?.timer);
  if (session?.recorder?.state === "recording") session.recorder.stop();
};

const dispose = (session: RecordingSession) => {
  session.controller.abort();
  stopRecording(session);
  stopTracks(session.stream);
};

export const useVoiceTaskDraft = (onDraft: (draft: VoiceTaskDraft) => void) => {
  const active = useRef<RecordingSession | null>(null);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => {
    const session = active.current;
    active.current = null;
    if (session) dispose(session);
  }, []);

  const finish = (session: RecordingSession) => {
    if (active.current !== session) return;
    active.current = null;
    dispose(session);
    setPhase("idle");
  };

  const requestDraft = async (session: RecordingSession, body?: Blob) => {
    if (active.current !== session) return;
    setPhase("processing");
    try {
      const { data } = await fetchJson("/api/tasks/voice-draft", VoiceTaskDraftResponseSchema, {
        method: "POST",
        headers: { "x-local-date": toLocalDateTime(new Date()).slice(0, 10) },
        body,
        signal: session.controller.signal,
      });
      if (active.current !== session) return;
      onDraft(data);
      setMessage("Чернетка готова. Перевірте поля перед збереженням.");
    } catch (failure) {
      if (active.current !== session) return;
      setError(failure instanceof ApiError ? failure.message : "Не вдалося отримати чернетку. Спробуйте ще раз.");
    } finally {
      finish(session);
    }
  };

  const begin = async (demo: boolean) => {
    if (active.current) return;
    setError("");
    setMessage("");
    const session: RecordingSession = { controller: new AbortController() };
    active.current = session;
    if (demo) {
      await requestDraft(session);
      return;
    }

    const format = typeof MediaRecorder === "undefined" ? undefined
      : [...VOICE_AUDIO_EXTENSIONS.keys()].find((type) => MediaRecorder.isTypeSupported(type));
    if (!navigator.mediaDevices?.getUserMedia || !format) {
      setError("У цьому браузері запис недоступний. Заповніть задачу вручну.");
      finish(session);
      return;
    }

    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (active.current !== session) {
        stopTracks(stream);
        return;
      }
      session.stream = stream;
      const recorder = new MediaRecorder(stream, { mimeType: format, audioBitsPerSecond: 64_000 });
      session.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = ({ data }) => { if (data.size > 0) chunks.push(data); };
      recorder.onerror = () => {
        if (active.current !== session) return;
        setError("Не вдалося записати звук. Спробуйте ще раз.");
        finish(session);
      };
      recorder.onstop = () => {
        clearTimeout(session.timer);
        stopTracks(stream);
        session.stream = undefined;
        if (active.current !== session) return;
        const audio = new Blob(chunks, { type: recorder.mimeType || format });
        if (!audio.size || audio.size > VOICE_AUDIO_MAX_BYTES) {
          setError(audio.size ? "Запис завеликий. Спробуйте коротший запис." : "Запис порожній. Спробуйте ще раз.");
          finish(session);
          return;
        }
        void requestDraft(session, audio);
      };
      recorder.start();
      session.timer = setTimeout(() => stopRecording(session), VOICE_RECORDING_MAX_MS);
      setPhase("recording");
    } catch (failure) {
      if (active.current !== session) return;
      setError(failure instanceof DOMException && failure.name === "NotAllowedError"
        ? "Дозвольте доступ до мікрофона або заповніть задачу вручну."
        : "Не вдалося ввімкнути мікрофон. Перевірте підключення і спробуйте ще раз.");
      finish(session);
    }
  };

  const cancel = () => {
    if (active.current) finish(active.current);
  };

  return { phase, message, error, begin, cancel, stop: () => stopRecording(active.current ?? undefined) };
};
