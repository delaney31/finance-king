import type {
  SpeechRecognitionDiagnostics,
  SpeechRecognitionEngineCallbacks,
  SpeechRecognitionEngineOptions,
} from "./types";
import { DEFAULT_SILENCE_TIMEOUT_MS } from "./types";

type RecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Single long-lived speech recognition session manager.
 * Creates one recognition instance per session, auto-restarts on browser onend,
 * and tracks why recognition ended.
 */
export class SpeechRecognitionEngine {
  readonly isSupported: boolean;

  private recognition: SpeechRecognition | null = null;
  private callbacks: SpeechRecognitionEngineCallbacks = {};
  private options: SpeechRecognitionEngineOptions = {};

  private sessionActive = false;
  private userRequestedStop = false;
  private isStarting = false;
  private finalTranscript = "";
  private interimTranscript = "";

  private restartCount = 0;
  private lastEvent = "idle";
  private lastError: string | null = null;
  private sessionStartedAt = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceDeadlineAt: number | null = null;

  constructor() {
    this.isSupported = !!getSpeechRecognitionCtor();
  }

  getDiagnostics(): SpeechRecognitionDiagnostics {
    return {
      recognitionExists: this.recognition != null,
      sessionActive: this.sessionActive,
      userRequestedStop: this.userRequestedStop,
      restartCount: this.restartCount,
      lastEvent: this.lastEvent,
      lastError: this.lastError,
      elapsedMs: this.sessionStartedAt ? Date.now() - this.sessionStartedAt : 0,
      silenceRemainingMs:
        this.silenceDeadlineAt != null
          ? Math.max(0, this.silenceDeadlineAt - Date.now())
          : null,
    };
  }

  isSessionActive(): boolean {
    return this.sessionActive;
  }

  start(
    callbacks: SpeechRecognitionEngineCallbacks,
    options: SpeechRecognitionEngineOptions = {}
  ): void {
    if (!this.isSupported) {
      callbacks.onError?.("Voice input is not supported in this browser", true);
      callbacks.onEnd?.("ERROR");
      return;
    }

    if (this.sessionActive || this.isStarting) {
      this.log("start-ignored", "session already active");
      return;
    }

    this.callbacks = callbacks;
    this.options = {
      continuous: true,
      interimResults: true,
      lang: "en-US",
      silenceTimeoutMs: DEFAULT_SILENCE_TIMEOUT_MS,
      autoRestartOnBrowserEnd: true,
      ...options,
    };

    this.sessionActive = true;
    this.userRequestedStop = false;
    this.finalTranscript = "";
    this.interimTranscript = "";
    this.restartCount = 0;
    this.lastError = null;
    this.sessionStartedAt = Date.now();
    this.log("session-start");

    this.beginRecognition();
  }

  stop(): void {
    if (!this.sessionActive) return;
    this.log("user-stop");
    this.userRequestedStop = true;
    this.clearSilenceTimer();
    this.recognition?.stop();
  }

  abort(): void {
    this.log("abort");
    this.userRequestedStop = true;
    this.sessionActive = false;
    this.clearSilenceTimer();
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition.onresult = null;
      this.recognition.abort();
      this.recognition = null;
    }
    this.isStarting = false;
  }

  appendFinalTranscript(text: string): void {
    if (!text.trim()) return;
    this.finalTranscript = `${this.finalTranscript} ${text}`.trim();
    this.interimTranscript = "";
    this.emitTranscript();
  }

  setTranscript(text: string): void {
    this.finalTranscript = text;
    this.interimTranscript = "";
    this.emitTranscript();
  }

  getTranscript(): string {
    return `${this.finalTranscript} ${this.interimTranscript}`.trim();
  }

  private beginRecognition(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !this.sessionActive) return;

    if (this.isStarting) {
      this.log("begin-ignored", "already starting");
      return;
    }

    this.isStarting = true;
    this.log(this.restartCount > 0 ? "recognition-restart" : "recognition-start");

    try {
      if (this.recognition) {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        try {
          this.recognition.abort();
        } catch {
          // ignore
        }
      }

      this.recognition = new Ctor();
      this.recognition.continuous = this.options.continuous ?? true;
      this.recognition.interimResults = this.options.interimResults ?? true;
      this.recognition.lang = this.options.lang ?? "en-US";

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        this.handleResult(event);
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.handleError(event);
      };

      this.recognition.onend = () => {
        this.handleEnd();
      };

      this.recognition.start();
      this.isStarting = false;
      this.callbacks.onStateChange?.(true);
      this.resetSilenceTimer();
    } catch (err) {
      this.isStarting = false;
      const message = err instanceof Error ? err.message : "Failed to start speech recognition";
      this.lastError = message;
      this.log("start-error", message);
      this.callbacks.onError?.(message, true);
      this.sessionActive = false;
      this.callbacks.onEnd?.("ERROR");
    }
  }

  private handleResult(event: SpeechRecognitionEvent): void {
    this.log("result");
    let interim = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? "";
      if (!text) continue;

      if (result.isFinal) {
        this.finalTranscript = `${this.finalTranscript} ${text}`.trim();
        interim = "";
      } else {
        interim += text;
      }
    }

    this.interimTranscript = interim.trim();
    this.emitTranscript();
    this.resetSilenceTimer();
  }

  private handleError(event: SpeechRecognitionErrorEvent): void {
    this.log("error", event.error);
    this.lastError = event.error;

    if (event.error === "not-allowed") {
      this.sessionActive = false;
      this.callbacks.onError?.("Microphone permission denied", true);
      this.callbacks.onEnd?.("ERROR");
      return;
    }

    if (event.error === "aborted") {
      return;
    }

    if (event.error === "no-speech") {
      if (this.sessionActive && !this.userRequestedStop) {
        this.scheduleRestart("no-speech");
      }
      return;
    }

    if (event.error === "network") {
      this.callbacks.onError?.("Network error during speech recognition", false);
      if (this.sessionActive && !this.userRequestedStop) {
        this.scheduleRestart("network");
      }
      return;
    }

    this.callbacks.onError?.(event.error, false);
  }

  private handleEnd(): void {
    this.log("browser-onend");
    this.clearSilenceTimer();
    this.isStarting = false;

    if (!this.sessionActive) {
      this.callbacks.onEnd?.("CANCEL");
      return;
    }

    if (this.userRequestedStop) {
      this.sessionActive = false;
      this.callbacks.onStateChange?.(false);
      this.callbacks.onEnd?.("USER_STOP");
      return;
    }

    if (this.options.autoRestartOnBrowserEnd !== false) {
      this.scheduleRestart("browser-end");
      return;
    }

    this.sessionActive = false;
    this.callbacks.onStateChange?.(false);
    this.callbacks.onEnd?.("BROWSER_END");
  }

  private scheduleRestart(reason: string): void {
    if (!this.sessionActive || this.userRequestedStop) return;
    this.restartCount += 1;
    this.log("schedule-restart", reason);
    setTimeout(() => {
      if (this.sessionActive && !this.userRequestedStop) {
        this.beginRecognition();
      }
    }, 120);
  }

  private emitTranscript(): void {
    this.callbacks.onTranscript?.(this.finalTranscript, this.interimTranscript);
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    if (!this.sessionActive || this.userRequestedStop) return;

    const timeout = this.options.silenceTimeoutMs ?? DEFAULT_SILENCE_TIMEOUT_MS;
    this.silenceDeadlineAt = Date.now() + timeout;
    this.silenceTimer = setTimeout(() => {
      if (this.sessionActive && !this.userRequestedStop) {
        this.log("silence-timeout");
        this.userRequestedStop = true;
        this.recognition?.stop();
      }
    }, timeout);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.silenceDeadlineAt = null;
  }

  private log(event: string, detail?: string): void {
    this.lastEvent = detail ? `${event}:${detail}` : event;
    this.callbacks.onDiagnostic?.(event, detail);
  }
}

export function createSpeechRecognitionEngine(): SpeechRecognitionEngine {
  return new SpeechRecognitionEngine();
}
