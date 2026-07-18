import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpeechRecognitionEngine } from "../speech-recognition-engine";

type MockRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

function createMockRecognition(): MockRecognition {
  return {
    continuous: true,
    interimResults: true,
    lang: "en-US",
    onresult: null,
    onerror: null,
    onend: null,
    start: vi.fn(),
    stop: vi.fn(() => {
      mockRecognition.onend?.();
    }),
    abort: vi.fn(),
  };
}

let mockRecognition: MockRecognition;
let MockCtor: new () => MockRecognition;

function installMockSpeechRecognition() {
  mockRecognition = createMockRecognition();
  MockCtor = vi.fn(function MockSpeechRecognition(this: MockRecognition) {
    return mockRecognition;
  }) as unknown as new () => MockRecognition;

  vi.stubGlobal("window", {
    SpeechRecognition: MockCtor,
    webkitSpeechRecognition: MockCtor,
  });
}

function makeResultEvent(text: string, isFinal: boolean): SpeechRecognitionEvent {
  return {
    resultIndex: 0,
    results: [
      {
        isFinal,
        0: { transcript: text },
        length: 1,
      },
    ],
  } as unknown as SpeechRecognitionEvent;
}

describe("SpeechRecognitionEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMockSpeechRecognition();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts listening and stays active until user stop", () => {
    const engine = new SpeechRecognitionEngine();
    const onEnd = vi.fn();

    engine.start({ onEnd });
    expect(mockRecognition.start).toHaveBeenCalledTimes(1);
    expect(engine.isSessionActive()).toBe(true);

    mockRecognition.onresult?.(makeResultEvent("hello", false));
    expect(engine.getTranscript()).toBe("hello");

    mockRecognition.onend?.();
    expect(engine.isSessionActive()).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("auto-restarts after browser onend", () => {
    const engine = new SpeechRecognitionEngine();
    engine.start({});

    mockRecognition.onend?.();
    vi.advanceTimersByTime(150);

    expect(MockCtor).toHaveBeenCalledTimes(2);
    expect(engine.getDiagnostics().restartCount).toBe(1);
  });

  it("does not restart after user stop", () => {
    const engine = new SpeechRecognitionEngine();
    const onEnd = vi.fn();
    engine.start({ onEnd });

    engine.stop();
    mockRecognition.onend?.();

    vi.advanceTimersByTime(200);
    expect(MockCtor).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith("USER_STOP");
  });

  it("appends final transcript segments", () => {
    const engine = new SpeechRecognitionEngine();
    engine.start({});

    mockRecognition.onresult?.(makeResultEvent("hello", true));
    mockRecognition.onresult?.(makeResultEvent("world", true));

    expect(engine.getTranscript()).toBe("hello world");
  });

  it("handles no-speech by scheduling restart", () => {
    const engine = new SpeechRecognitionEngine();
    engine.start({});

    mockRecognition.onerror?.({ error: "no-speech" } as SpeechRecognitionErrorEvent);
    vi.advanceTimersByTime(150);

    expect(MockCtor).toHaveBeenCalledTimes(2);
  });

  it("stops on silence timeout", () => {
    const engine = new SpeechRecognitionEngine();
    engine.start({}, { silenceTimeoutMs: 5000 });

    vi.advanceTimersByTime(5000);
    expect(mockRecognition.stop).toHaveBeenCalled();
  });

  it("resets silence timer on speech activity", () => {
    const engine = new SpeechRecognitionEngine();
    engine.start({}, { silenceTimeoutMs: 5000 });

    vi.advanceTimersByTime(3000);
    mockRecognition.onresult?.(makeResultEvent("still talking", false));
    vi.advanceTimersByTime(3000);

    expect(mockRecognition.stop).not.toHaveBeenCalled();
  });

  it("ignores duplicate start calls", () => {
    const engine = new SpeechRecognitionEngine();
    engine.start({});
    engine.start({});

    expect(MockCtor).toHaveBeenCalledTimes(1);
  });

  it("handles permission denied", () => {
    const engine = new SpeechRecognitionEngine();
    const onEnd = vi.fn();
    const onError = vi.fn();

    engine.start({ onEnd, onError });
    mockRecognition.onerror?.({ error: "not-allowed" } as SpeechRecognitionErrorEvent);

    expect(onError).toHaveBeenCalledWith("Microphone permission denied", true);
    expect(onEnd).toHaveBeenCalledWith("ERROR");
    expect(engine.isSessionActive()).toBe(false);
  });

  it("supports long speech with multiple final segments across restarts", () => {
    const engine = new SpeechRecognitionEngine();
    const onTranscript = vi.fn();

    engine.start({ onTranscript });
    mockRecognition.onresult?.(makeResultEvent("first phrase", true));
    mockRecognition.onend?.();
    vi.advanceTimersByTime(150);

    mockRecognition.onresult?.(makeResultEvent("second phrase", true));
    expect(engine.getTranscript()).toBe("first phrase second phrase");
    expect(engine.isSessionActive()).toBe(true);
  });

  it("emits BROWSER_END when auto restart is disabled", () => {
    const engine = new SpeechRecognitionEngine();
    const onEnd = vi.fn();

    engine.start({ onEnd }, { autoRestartOnBrowserEnd: false });
    mockRecognition.onend?.();

    expect(onEnd).toHaveBeenCalledWith("BROWSER_END");
    expect(engine.isSessionActive()).toBe(false);
  });

  it("cancel aborts session", () => {
    const engine = new SpeechRecognitionEngine();
    engine.start({});
    engine.abort();

    expect(mockRecognition.abort).toHaveBeenCalled();
    expect(engine.isSessionActive()).toBe(false);
  });
});
