"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeechRecognitionEngine } from "./speech-recognition-engine";
import type { RecognitionEndReason, SpeechRecognitionDiagnostics, VoiceInputState } from "./types";
import { DEFAULT_SILENCE_TIMEOUT_MS } from "./types";

const STATE_LABELS: Record<VoiceInputState, string> = {
  IDLE: "",
  UNSUPPORTED: "Voice input is not supported in this browser",
  REQUESTING_PERMISSION: "Requesting microphone…",
  STARTING: "Starting…",
  LISTENING: "Listening… Tap to stop",
  STOPPING: "Stopping…",
  PROCESSING: "Processing speech…",
  READY: "Transcript ready",
  ERROR: "",
};

export type UseVoiceInputOptions = {
  silenceTimeoutMs?: number;
  onAnnouncement?: (message: string) => void;
};

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const silenceTimeoutMs = options.silenceTimeoutMs ?? DEFAULT_SILENCE_TIMEOUT_MS;

  const [state, setState] = useState<VoiceInputState>("IDLE");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [diagnostics, setDiagnostics] = useState<SpeechRecognitionDiagnostics | null>(null);

  const engineRef = useRef(createSpeechRecognitionEngine());
  const stateRef = useRef<VoiceInputState>("IDLE");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const transcript = `${finalTranscript} ${interimTranscript}`.trim();

  const setStateSafe = useCallback((next: VoiceInputState) => {
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  const announce = useCallback(
    (message: string) => {
      options.onAnnouncement?.(message);
    },
    [options]
  );

  const clearElapsedTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedMs(0);
  }, []);

  const startElapsedTimer = useCallback(() => {
    clearElapsedTimer();
    const started = Date.now();
    timerRef.current = setInterval(() => {
      if (mountedRef.current) setElapsedMs(Date.now() - started);
      setDiagnostics(engineRef.current.getDiagnostics());
    }, 250);
  }, [clearElapsedTimer]);

  const handleEnd = useCallback(
    (reason: RecognitionEndReason) => {
      clearElapsedTimer();
      setDiagnostics(engineRef.current.getDiagnostics());

      if (reason === "CANCEL") {
        setStateSafe("IDLE");
        return;
      }

      if (reason === "ERROR") {
        setStateSafe("ERROR");
        return;
      }

      setInterimTranscript("");
      setStateSafe("PROCESSING");

      setTimeout(() => {
        if (!mountedRef.current) return;
        setStateSafe("READY");
        announce("Listening stopped");
      }, 150);
    },
    [announce, clearElapsedTimer, setStateSafe]
  );

  const beginSession = useCallback(
    (clearExisting: boolean) => {
      const engine = engineRef.current;

      if (!engine.isSupported) {
        setError("Voice input is not supported in this browser");
        setStateSafe("UNSUPPORTED");
        return;
      }

      if (engine.isSessionActive() || stateRef.current === "LISTENING" || stateRef.current === "STARTING") {
        return;
      }

      if (clearExisting) {
        setFinalTranscript("");
        setInterimTranscript("");
      }

      setError(null);
      setStateSafe("REQUESTING_PERMISSION");

      setTimeout(() => {
        if (!mountedRef.current) return;
        setStateSafe("STARTING");

        engine.start(
          {
            onStateChange: (listening) => {
              if (!mountedRef.current) return;
              if (listening) {
                setStateSafe("LISTENING");
                startElapsedTimer();
                announce("Listening started");
              }
            },
            onTranscript: (finalText, interimText) => {
              if (!mountedRef.current) return;
              setFinalTranscript(finalText);
              setInterimTranscript(interimText);
              if (stateRef.current !== "LISTENING") {
                setStateSafe("LISTENING");
              }
              setDiagnostics(engine.getDiagnostics());
            },
            onError: (message, fatal) => {
              if (!mountedRef.current) return;
              if (fatal) {
                setError(message);
                setStateSafe("ERROR");
                clearElapsedTimer();
              }
            },
            onEnd: handleEnd,
            onDiagnostic: () => {
              if (mountedRef.current) setDiagnostics(engine.getDiagnostics());
            },
          },
          { silenceTimeoutMs }
        );
      }, 0);
    },
    [announce, clearElapsedTimer, handleEnd, setStateSafe, silenceTimeoutMs, startElapsedTimer]
  );

  const startListening = useCallback(() => {
    beginSession(true);
  }, [beginSession]);

  const stopListening = useCallback(() => {
    if (!engineRef.current.isSessionActive()) return;
    setStateSafe("STOPPING");
    engineRef.current.stop();
  }, [setStateSafe]);

  const cancel = useCallback(() => {
    clearElapsedTimer();
    engineRef.current.abort();
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
    setStateSafe("IDLE");
    setDiagnostics(engineRef.current.getDiagnostics());
  }, [clearElapsedTimer, setStateSafe]);

  const toggleListening = useCallback(
    (event?: React.SyntheticEvent) => {
      event?.preventDefault();
      event?.stopPropagation();

      const current = stateRef.current;
      if (current === "LISTENING" || current === "STARTING" || current === "REQUESTING_PERMISSION") {
        stopListening();
        return;
      }
      if (current === "IDLE" || current === "ERROR" || current === "READY" || current === "UNSUPPORTED") {
        if (current === "READY") {
          beginSession(false);
        } else {
          startListening();
        }
      }
    },
    [beginSession, startListening, stopListening]
  );

  const setTranscript = useCallback((text: string) => {
    setFinalTranscript(text);
    setInterimTranscript("");
    engineRef.current.setTranscript(text);
  }, []);

  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  useEffect(() => {
    mountedRef.current = true;
    const engine = engineRef.current;
    if (!engine.isSupported) {
      setStateSafe("UNSUPPORTED");
    }
    return () => {
      mountedRef.current = false;
      clearElapsedTimer();
      engine.abort();
    };
  }, [clearElapsedTimer, setStateSafe]);

  const isListening =
    state === "LISTENING" || state === "STARTING" || state === "REQUESTING_PERMISSION";
  const isActive =
    isListening || state === "STOPPING" || state === "PROCESSING";

  return {
    state,
    stateLabel: STATE_LABELS[state],
    transcript,
    finalTranscript,
    interimTranscript,
    setTranscript,
    error,
    isSupported: engineRef.current.isSupported,
    isListening,
    isActive,
    elapsedMs,
    diagnostics,
    startListening,
    stopListening,
    toggleListening,
    cancel,
    reset,
  };
}
