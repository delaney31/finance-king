"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Info,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Shield,
} from "lucide-react";
import type { CFOAssistantResponse } from "@/lib/ai/types";
import type { CFODataCommand } from "@/lib/ai/commands/schemas";
import { FINANCIAL_STATE_CHANGED_EVENT } from "@/lib/financial-state/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CfoCompactAnswerCard } from "./cfo-compact-answer-card";
import { CfoUpdateConfirmationCard, CfoUpdateResultCard } from "./cfo-update-confirmation-card";
import { useAskMyCfo } from "./ask-my-cfo-provider";

type ComposerMode = "ask" | "update";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: CFOAssistantResponse;
  snapshotStale?: boolean;
  recalculated?: boolean;
  basedOnOlderBalances?: boolean;
  updateResult?: {
    message: string;
    metricChanges: Array<{ metric: string; before: number; after: number; difference: number }>;
    auditId?: string;
  };
}

const ASK_EXAMPLES = [
  "Can I afford dinner?",
  "Why is my safe-to-spend low?",
  "What should I pay Amex?",
];

const UPDATE_EXAMPLES = [
  "Update PenFed checking to $26,450",
  "Mark mortgage paid",
  "Record $5,000 W-2 deposit",
  "Transfer $2,900 to Wells Fargo",
];

const LOADING_STEPS = [
  "Understanding your question…",
  "Checking your balances…",
  "Reviewing upcoming bills…",
  "Preparing your answer…",
];

export function AskMyCfoPanel() {
  const { open, setOpen } = useAskMyCfo();
  const [composerMode, setComposerMode] = useState<ComposerMode>("ask");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [usage, setUsage] = useState<{ remainingToday: number; dailyLimit: number } | null>(null);
  const [showUsageInfo, setShowUsageInfo] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<{
    command: CFODataCommand;
    preview: Record<string, unknown>;
    originalMessage: string;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fetchSuggested = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/cfo/suggested-questions");
      if (res.ok) {
        const data = await res.json();
        setSuggested(data.questions ?? []);
      }
    } catch {
      setSuggested(["How much can I safely spend today?"]);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/cfo/usage");
      if (res.ok) setUsage(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSuggested();
      fetchUsage();
    }
  }, [open, fetchSuggested, fetchUsage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [loading]);

  const sendQuestion = async (q: string, options?: { replaceMessageId?: string; isRecalculate?: boolean }) => {
    if (!q.trim() || loading) return;
    setError(null);
    setLoading(true);
    setLoadingStep(0);
    setPendingCommand(null);

    if (!options?.isRecalculate) {
      const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: q.trim() };
      setMessages((prev) => [...prev, userMsg]);
    }
    setQuestion("");

    try {
      const url = conversationId
        ? `/api/v1/cfo/conversations/${conversationId}/messages`
        : "/api/v1/cfo/conversations";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim(), conversationId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      setConversationId(data.conversationId);

      if (options?.replaceMessageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === options.replaceMessageId
              ? {
                  ...m,
                  content: data.response.compact?.advice ?? data.response.answer,
                  response: data.response,
                  snapshotStale: false,
                  recalculated: true,
                }
              : { ...m, basedOnOlderBalances: m.role === "assistant" ? true : m.basedOnOlderBalances }
          )
        );
      } else {
        setMessages((prev) => [
          ...prev.map((m) =>
            m.role === "assistant" ? { ...m, basedOnOlderBalances: true, snapshotStale: true } : m
          ),
          {
            id: data.messageId,
            role: "assistant",
            content: data.response.compact?.advice ?? data.response.answer,
            response: data.response,
            snapshotStale: data.snapshotStale,
          },
        ]);
      }
      fetchUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (q: string) => {
    if (!q.trim() || loading) return;

    if (composerMode === "update" || /update|transfer|mark.*paid|record.*deposit|balance is now/i.test(q)) {
      setError(null);
      setLoading(true);
      const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: q.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setQuestion("");

      try {
        const res = await fetch("/api/v1/cfo/commands/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Parse failed");

        if (data.preview?.type === "clarification") {
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}`, role: "assistant", content: data.preview.question },
          ]);
        } else if (data.needsConfirmation) {
          setPendingCommand({
            command: data.command,
            preview: data.preview,
            originalMessage: q.trim(),
          });
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: data.command.clarificationQuestion ?? "I need more details to update your records.",
            },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not parse update");
      } finally {
        setLoading(false);
      }
      return;
    }

    await sendQuestion(q);
  };

  const confirmUpdate = async () => {
    if (!pendingCommand || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/cfo/commands/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: pendingCommand.command,
          originalMessage: pendingCommand.originalMessage,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? "Update failed");

      setPendingCommand(null);
      setMessages((prev) => [
        ...prev.map((m) =>
          m.role === "assistant" ? { ...m, basedOnOlderBalances: true, snapshotStale: true } : m
        ),
        {
          id: `u-${Date.now()}`,
          role: "assistant",
          content: result.message,
          updateResult: {
            message: result.message,
            metricChanges: result.metricChanges,
            auditId: result.auditId,
          },
        },
      ]);

      window.dispatchEvent(
        new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT, {
          detail: {
            userId: "",
            previousSnapshotId: result.previousSnapshotId,
            newSnapshotId: result.newSnapshotId,
            reason: pendingCommand.command.intent,
            changedEntityIds: result.updatedEntities?.map((e: { id: string }) => e.id) ?? [],
          },
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const undoUpdate = async (auditId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/cfo/commands/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? "Undo failed");
      window.dispatchEvent(
        new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT, {
          detail: {
            userId: "",
            previousSnapshotId: result.previousSnapshotId,
            newSnapshotId: result.newSnapshotId,
            reason: "undo",
            changedEntityIds: [],
          },
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setLoading(false);
    }
  };

  const newConversation = () => {
    setConversationId(undefined);
    setMessages([]);
    setError(null);
  };

  const lowUsage = usage != null && usage.remainingToday < 10;

  const panelContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 flex items-start justify-between border-b border-fk-border/60 px-4 py-3 pr-12">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Bot className="h-5 w-5 text-fk-gold" aria-hidden />
            Ask My CFO
          </h2>
          <p className="mt-0.5 text-xs text-fk-muted">Clear answers from your real numbers</p>
          {lowUsage && usage && (
            <p className="mt-1 text-xs text-amber-400">
              {usage.remainingToday} of {usage.dailyLimit} requests left today
            </p>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUsageInfo((v) => !v)}
            className="rounded-md p-1.5 text-fk-muted hover:bg-fk-charcoal hover:text-fk-foreground"
            aria-label="Usage information"
          >
            <Info className="h-4 w-4" />
          </button>
          {showUsageInfo && usage && (
            <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-fk-border bg-fk-navy p-3 text-xs text-fk-muted shadow-lg">
              {usage.remainingToday} of {usage.dailyLimit} AI requests remaining today
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-fk-muted">
              {composerMode === "ask" ? "Ask anything, or try:" : "Update your records, or try:"}
            </p>
            <div className="flex flex-wrap gap-2">
              {(composerMode === "ask" ? ASK_EXAMPLES : UPDATE_EXAMPLES).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSubmit(q)}
                  className="rounded-full border border-fk-border/80 px-3 py-1.5 text-left text-xs text-fk-muted transition-colors hover:border-fk-gold/40 hover:text-fk-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {pendingCommand && (
          <CfoUpdateConfirmationCard
            command={pendingCommand.command}
            preview={pendingCommand.preview as unknown as Parameters<typeof CfoUpdateConfirmationCard>[0]["preview"]}
            loading={loading}
            onConfirm={confirmUpdate}
            onCancel={() => setPendingCommand(null)}
          />
        )}

        {messages.map((m, idx) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-md bg-fk-gold/15 px-3.5 py-2 text-sm">
                  {m.content}
                </div>
              </div>
            );
          }

          const userQuestion =
            [...messages].slice(0, idx).reverse().find((x) => x.role === "user")?.content ?? m.content;

          return m.updateResult ? (
            <CfoUpdateResultCard
              key={m.id}
              message={m.updateResult.message}
              metricChanges={m.updateResult.metricChanges}
              auditId={m.updateResult.auditId}
              onUndo={m.updateResult.auditId ? () => undoUpdate(m.updateResult!.auditId!) : undefined}
              loading={loading}
            />
          ) : m.response?.compact ? (
            <div key={m.id}>
              {(m.basedOnOlderBalances || m.snapshotStale) && !m.recalculated && (
                <p className="mb-2 text-xs text-amber-300">Based on older balances</p>
              )}
              <CfoCompactAnswerCard
                question={userQuestion}
                response={m.response}
                compact={m.response.compact}
                snapshotStale={m.snapshotStale}
                recalculated={m.recalculated}
                onRecalculate={() => sendQuestion(userQuestion, { replaceMessageId: m.id, isRecalculate: true })}
                onFollowUp={handleSubmit}
              />
            </div>
          ) : (
            <p key={m.id} className="text-sm">
              {m.content}
            </p>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-fk-muted" aria-busy="true" aria-label="Analyzing your question">
            <Loader2 className="h-4 w-4 animate-spin text-fk-gold" aria-hidden />
            {LOADING_STEPS[loadingStep]}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {error}
            <Button variant="ghost" size="sm" className="mt-2 h-8" onClick={() => setError(null)}>
              <RefreshCw className="mr-1 h-3 w-3" /> Retry
            </Button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-fk-border/60 px-3 py-3">
        <div className="mb-2 flex gap-1 rounded-lg bg-fk-charcoal/50 p-0.5">
          <button
            type="button"
            onClick={() => setComposerMode("ask")}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${composerMode === "ask" ? "bg-fk-navy text-fk-gold" : "text-fk-muted"}`}
          >
            Ask a question
          </button>
          <button
            type="button"
            onClick={() => setComposerMode("update")}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${composerMode === "update" ? "bg-fk-navy text-fk-gold" : "text-fk-muted"}`}
          >
            Update my finances
          </button>
        </div>
        <p className="mb-2 flex items-center gap-1 text-[10px] text-fk-muted">
          <Shield className="h-3 w-3 shrink-0" />
          Finance King will always show a preview before changing your records.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={newConversation}
            title="New conversation"
            aria-label="New conversation"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Input
            placeholder={
              composerMode === "update"
                ? "Update a balance, record income, or mark a bill paid…"
                : "Ask about spending, bills, or debt…"
            }
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit(question);
              }
            }}
            className="h-9 flex-1 border-fk-border/80 bg-fk-charcoal/50 text-sm"
            disabled={loading}
            aria-label={composerMode === "update" ? "Update financial records" : "Ask your CFO a question"}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => handleSubmit(question)}
            disabled={loading || !question.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!isMobile && (
        <div
          className={`hidden md:flex md:h-full md:min-h-0 md:flex-col md:border-l md:border-fk-border/60 md:bg-fk-navy/90 md:transition-all md:duration-300 ${
            open ? "md:w-[24rem] lg:w-[26rem] md:shrink-0 md:overflow-hidden" : "md:w-0 md:overflow-hidden md:border-0"
          }`}
        >
          {open && panelContent}
        </div>
      )}

      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[92vh] overflow-hidden p-0">
            {panelContent}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

export function AskMyCfoButton() {
  const { toggle, open } = useAskMyCfo();

  return (
    <Button
      onClick={toggle}
      variant={open ? "default" : "outline"}
      size="sm"
      className="gap-2 border-fk-gold/50 text-fk-gold hover:bg-fk-gold/10"
    >
      <Bot className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Ask My CFO</span>
      <span className="sm:hidden">CFO</span>
    </Button>
  );
}
