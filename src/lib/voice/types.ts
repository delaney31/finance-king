export type VoiceInputState =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "STARTING"
  | "LISTENING"
  | "STOPPING"
  | "PROCESSING"
  | "READY"
  | "ERROR"
  | "UNSUPPORTED";

export type RecognitionEndReason = "USER_STOP" | "CANCEL" | "ERROR" | "BROWSER_END";

export interface SpeechRecognitionEngineCallbacks {
  onStateChange?: (listening: boolean) => void;
  onTranscript?: (finalText: string, interimText: string) => void;
  onError?: (message: string, fatal: boolean) => void;
  onEnd?: (reason: RecognitionEndReason) => void;
  onDiagnostic?: (event: string, detail?: string) => void;
}

export interface SpeechRecognitionEngineOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  silenceTimeoutMs?: number;
  autoRestartOnBrowserEnd?: boolean;
}

export interface SpeechToTextProvider {
  readonly isSupported: boolean;
  start(options?: SpeechRecognitionEngineCallbacks & SpeechRecognitionEngineOptions): void;
  stop(): void;
  abort(): void;
  isSessionActive(): boolean;
  getDiagnostics(): SpeechRecognitionDiagnostics;
}

export interface SpeechRecognitionDiagnostics {
  recognitionExists: boolean;
  sessionActive: boolean;
  userRequestedStop: boolean;
  restartCount: number;
  lastEvent: string;
  lastError: string | null;
  elapsedMs: number;
  silenceRemainingMs: number | null;
}

export interface SpeechToTextBlobProvider {
  transcribe(input: Blob): Promise<{
    transcript: string;
    confidence?: number;
  }>;
}

export const DEFAULT_SILENCE_TIMEOUT_MS = 5000;

export const SILENCE_TIMEOUT_OPTIONS = [3000, 5000, 8000, 10000] as const;
