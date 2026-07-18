"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSpeechProvider } from "./browser-speech-provider";
import type { VoiceInputState } from "./types";

const SILENCE_MS = 2500;

const STATE_LABELS: Record<VoiceInputState, string> = {
  IDLE: "",
  REQUESTING_PERMISSION: "Requesting microphone…",
  LISTENING: "Listening…",
  PROCESSING: "Processing speech…",
  READY: "Transcript ready",
  ERROR: "",
};

export function useVoiceInput() {
  const [state, setState] = useState<VoiceInputState>("IDLE");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const providerRef = useRef(createBrowserSpeechProvider());
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsSupported(providerRef.current.isSupported);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    providerRef.current.stop();
    setState((s) => (s === "LISTENING" ? "PROCESSING" : s));
  }, [clearSilenceTimer]);

  const cancel = useCallback(() => {
    clearSilenceTimer();
    providerRef.current.abort();
    setState("IDLE");
    setTranscript("");
    setError(null);
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
    if (!providerRef.current.isSupported) {
      setError("Voice input is not supported in this browser");
      setState("ERROR");
      return;
    }

    setError(null);
    setTranscript("");
    setState("REQUESTING_PERMISSION");

    providerRef.current.start({
      continuous: true,
      interimResults: true,
      onResult: (text, isFinal) => {
        setState("LISTENING");
        setTranscript(text);
        clearSilenceTimer();
        if (isFinal && text.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            providerRef.current.stop();
            setState("READY");
          }, SILENCE_MS);
        }
      },
      onError: (msg) => {
        clearSilenceTimer();
        setError(msg);
        setState("ERROR");
      },
      onEnd: () => {
        clearSilenceTimer();
        setState((s) => {
          if (s === "LISTENING" || s === "PROCESSING") return "READY";
          return s;
        });
      },
    });

    setState("LISTENING");
  }, [clearSilenceTimer]);

  const toggleListening = useCallback(() => {
    if (state === "LISTENING") {
      stopListening();
    } else if (state === "IDLE" || state === "ERROR" || state === "READY") {
      startListening();
    }
  }, [state, startListening, stopListening]);

  useEffect(() => {
    return () => {
      providerRef.current.abort();
      clearSilenceTimer();
    };
  }, [clearSilenceTimer]);

  return {
    state,
    stateLabel: STATE_LABELS[state],
    transcript,
    setTranscript,
    error,
    isSupported,
    isListening: state === "LISTENING",
    isActive: state === "LISTENING" || state === "REQUESTING_PERMISSION" || state === "PROCESSING",
    startListening,
    stopListening,
    toggleListening,
    cancel,
    reset: () => {
      cancel();
    },
  };
}
