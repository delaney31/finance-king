import type {
  SpeechRecognitionDiagnostics,
  SpeechRecognitionEngineCallbacks,
  SpeechRecognitionEngineOptions,
  SpeechToTextProvider,
} from "./types";
import { createSpeechRecognitionEngine, SpeechRecognitionEngine } from "./speech-recognition-engine";

export class BrowserSpeechProvider implements SpeechToTextProvider {
  readonly isSupported: boolean;
  private engine: SpeechRecognitionEngine;

  constructor(engine?: SpeechRecognitionEngine) {
    this.engine = engine ?? createSpeechRecognitionEngine();
    this.isSupported = this.engine.isSupported;
  }

  start(options?: SpeechRecognitionEngineCallbacks & SpeechRecognitionEngineOptions): void {
    const { continuous, interimResults, lang, silenceTimeoutMs, autoRestartOnBrowserEnd, ...callbacks } =
      options ?? {};
    this.engine.start(callbacks, {
      continuous,
      interimResults,
      lang,
      silenceTimeoutMs,
      autoRestartOnBrowserEnd,
    });
  }

  stop(): void {
    this.engine.stop();
  }

  abort(): void {
    this.engine.abort();
  }

  isSessionActive(): boolean {
    return this.engine.isSessionActive();
  }

  getDiagnostics(): SpeechRecognitionDiagnostics {
    return this.engine.getDiagnostics();
  }
}

export function createBrowserSpeechProvider(): SpeechToTextProvider {
  return new BrowserSpeechProvider();
}
