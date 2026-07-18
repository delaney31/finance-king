# Voice Input Analysis

## Files inspected

| File | Role |
|------|------|
| `src/lib/voice/use-voice-input.ts` | React hook — state, silence timer, start/stop/cancel |
| `src/lib/voice/browser-speech-provider.ts` | Web Speech API wrapper — creates recognition per `start()` |
| `src/lib/voice/types.ts` | `VoiceInputState`, `SpeechToTextProvider` interface |
| `src/components/cfo/cfo-voice-composer.tsx` | Ask My CFO mic + transcript UI |
| `src/components/voice/account-voice-sheet.tsx` | Account-level voice sheet mic |
| `src/types/speech-recognition.d.ts` | TypeScript declarations |

## Lifecycle trace

1. User taps mic → `toggleListening()` or `startListening()`
2. Hook sets `REQUESTING_PERMISSION`, clears transcript, calls `provider.start()`
3. Provider creates **new** `SpeechRecognition` instance, assigns handlers, calls `recognition.start()`
4. Hook sets `LISTENING` immediately after `start()` returns
5. `onresult` → updates transcript, resets silence timer on final results
6. Silence timer (2.5s) → `stop()` + `READY`
7. `onend` → transitions `LISTENING`/`PROCESSING` → `READY`
8. `onerror` (e.g. `no-speech`) → `ERROR` state

## Root cause — immediate stop (PRIMARY)

**`account-voice-sheet.tsx` lines 163–168:**

```tsx
onClick={voice.toggleListening}
onPointerDown={(e) => {
  if (e.button === 0 && e.pointerType === "touch") voice.startListening();
}}
onPointerUp={() => {
  if (voice.isListening) voice.stopListening();
}}
```

`onPointerUp` fires after **every** mouse click and touch release — not only for hold-to-speak. Sequence on desktop:

1. `click` → `toggleListening()` → `startListening()` → LISTENING
2. `pointerup` (same click) → `stopListening()` → STOPPED/READY

The mic activates then turns off within the same click. This matches the reported bug exactly.

## Root cause — browser `onend` treated as session end (SECONDARY)

**`use-voice-input.ts` `onEnd` handler:**

```ts
onEnd: () => {
  setState((s) => {
    if (s === "LISTENING" || s === "PROCESSING") return "READY";
    return s;
  });
},
```

- Safari ends recognition after **each phrase** even with `continuous: true`
- Chrome may fire `onend` between utterances
- Hook always moves to `READY` — button appears inactive, session over
- No auto-restart while user intended to keep speaking

## Root cause — `no-speech` error ends session (TERTIARY)

```ts
} else if (event.error === "no-speech") {
  options?.onError?.("No speech detected");
}
```

`no-speech` can fire during normal startup before the user speaks. Setting `ERROR` ends the session prematurely.

## Other issues found

| Issue | Location | Impact |
|-------|----------|--------|
| New recognition instance every `start()` | `browser-speech-provider.ts:46` | OK per session, but no restart on `onend` |
| Silence timeout 2500ms | `use-voice-input.ts:7` | Too aggressive vs 5000ms target |
| Transcript cleared on every start | `use-voice-input.ts:60` | Bad UX for record-again |
| `finalTranscript` missing spaces | `browser-speech-provider.ts:58` | Words run together |
| No `STARTING` / `STOPPING` states | types | Race conditions on rapid taps |
| No duplicate-start guard | hook | Double `start()` possible |
| No auto-restart on `BROWSER_END` | provider/hook | Safari/Chrome multi-phrase broken |
| `isListening` only when `state === LISTENING` | hook | UI flickers during STARTING/STOPPING |
| No `aria-pressed` on mic button | composers | Accessibility gap |
| Provider recreated once per hook via ref | hook:24 | OK — not per render |
| React Strict Mode | not enabled in app | Low risk; cleanup still calls `abort()` |
| Mic button has `type="button"` | cfo-voice-composer | OK — no form submit |
| No `preventDefault` on mic click | composers | Low risk without form wrapper |

## Answers to inspection questions

- **Where is SpeechRecognition created?** `BrowserSpeechProvider.start()` — new instance each session
- **Recreated every render?** No — provider stored in `useRef`, but new recognition per `start()`
- **`start()` called more than once?** Possible via double-tap; no guard
- **`stop()` unexpected?** Yes — `onPointerUp` in account voice sheet
- **`abort()` called?** On cancel and unmount cleanup
- **`onEnd` resets state?** Yes — always → READY (bug)
- **Strict Mode duplicate init?** Not currently; cleanup would abort active session
- **Rerender destroy instance?** No — ref persists
- **Form submit on mic click?** No — `type="button"` present
- **Multiple listeners?** New instance per start — old handlers discarded
- **`continuous`?** Yes — `true`
- **`interimResults`?** Yes — `true`
- **Silence timeout?** 2500ms — too short
- **Safari `onend`?** Not handled — session ends
- **Stale closure?** `toggleListening` depends on `state` — can be stale during rapid taps

## Fix strategy

1. Remove conflicting `onPointerUp` stop from account voice sheet (or isolate hold-to-speak)
2. Introduce `SpeechRecognitionEngine` with session ref, end-reason tracking, auto-restart
3. Expand state machine: IDLE → REQUESTING_PERMISSION → STARTING → LISTENING → STOPPING → PROCESSING → READY
4. Default silence timeout 5000ms, reset on speech activity
5. Separate `finalTranscript` + `interimTranscript`
6. Ignore/restart on `no-speech` during active session
7. Auto-restart on `BROWSER_END` unless user stopped
8. Add diagnostics panel (dev) and comprehensive tests

## Fixes implemented

| Issue | Fix |
|-------|-----|
| `onPointerUp` immediate stop | Removed from `account-voice-sheet.tsx`; tap-to-toggle only |
| `onEnd` always → READY | `SpeechRecognitionEngine` auto-restarts on browser `onend`; hook only ends on `USER_STOP` / `ERROR` / `CANCEL` |
| `no-speech` fatal | Engine schedules restart during active session |
| Silence 2500ms | Default `5000ms` in engine; configurable via `silenceTimeoutMs` |
| New recognition per phrase | Session manager with `scheduleRestart` on `BROWSER_END` |
| Transcript cleared on re-record | `beginSession(false)` preserves transcript when resuming from READY |
| Scattered booleans | Explicit `VoiceInputState` machine in hook |
| Duplicate starts | Guards in engine (`sessionActive`, `isStarting`) and hook (`stateRef`) |
| Accessibility | `aria-pressed`, announcements, 44px touch targets, red pulse while listening |
| Diagnostics | Dev-only panel: state, browser, recognition, restarts, errors, silence timer |
