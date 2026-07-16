"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadReviewPanel } from "@/components/uploads/upload-review-panel";
import type { ImportSummary } from "@/lib/uploads/types";

interface UploadItem {
  id: string;
  fileName: string;
  status: string;
  institution: string | null;
  documentType: string | null;
  createdAt: string;
}

interface AccountOption {
  id: string;
  nickname: string;
  institution: string;
  accountType: string;
}

const PROCESSING_STATUSES = new Set(["PENDING", "PROCESSING"]);

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Queued",
  PROCESSING: "Analyzing",
  REVIEW_REQUIRED: "Review required",
  CONFIRMED: "Confirmed",
  REJECTED: "Unsupported",
  DUPLICATE: "Duplicate",
};

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: "include", redirect: "manual", ...init });
  if (res.type === "opaqueredirect" || res.status === 307 || res.status === 302) {
    throw new Error("Session expired — refresh and sign in again.");
  }
  return res;
}

export function UploadsContent({
  initialUploads,
  accounts,
  storageReady,
}: {
  initialUploads: UploadItem[];
  accounts: AccountOption[];
  storageReady: boolean;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const uploadsRef = useRef(uploads);
  const processingIdsRef = useRef(processingIds);
  const pollAttemptsRef = useRef<Record<string, number>>({});
  const processStartedRef = useRef<Set<string>>(new Set());
  uploadsRef.current = uploads;
  processingIdsRef.current = processingIds;

  const refreshUpload = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/v1/uploads/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as UploadItem;
  }, []);

  const runProcessing = useCallback(async (id: string) => {
    if (processStartedRef.current.has(id)) return;
    processStartedRef.current.add(id);
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const res = await apiFetch(`/api/v1/uploads/${id}/process`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      const updated = await refreshUpload(id);
      if (updated) {
        setUploads((prev) => prev.map((u) => (u.id === id ? updated : u)));
      } else if (data.status) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id
              ? {
                  ...u,
                  status: data.status,
                  institution: data.institution ?? u.institution,
                  documentType: data.documentType ?? u.documentType,
                }
              : u
          )
        );
      }
    } catch (err) {
      console.error("Processing failed:", err);
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: "REVIEW_REQUIRED" } : u))
      );
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [refreshUpload]);

  useEffect(() => {
    for (const upload of initialUploads) {
      if (PROCESSING_STATUSES.has(upload.status)) {
        void runProcessing(upload.id);
      }
    }
  }, [initialUploads, runProcessing]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = uploadsRef.current.filter((u) => PROCESSING_STATUSES.has(u.status));
      if (pending.length === 0) return;

      for (const item of pending) {
        pollAttemptsRef.current[item.id] = (pollAttemptsRef.current[item.id] ?? 0) + 1;

        if (
          pollAttemptsRef.current[item.id] >= 2 &&
          !processStartedRef.current.has(item.id) &&
          !processingIdsRef.current.has(item.id)
        ) {
          void runProcessing(item.id);
        }
      }

      const updates = await Promise.all(
        pending.map(async (u) => refreshUpload(u.id).then((item) => item ?? u))
      );

      setUploads((prev) => {
        const byId = new Map(prev.map((u) => [u.id, u]));
        for (const item of updates) byId.set(item.id, item);
        return Array.from(byId.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [refreshUpload, runProcessing]);

  const onDrop = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    if (!storageReady) {
      setError("File storage is not configured on the server yet.");
      return;
    }

    setUploading(true);
    setError("");

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/v1/uploads", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const item = data as UploadItem;
        setUploads((prev) => [item, ...prev]);
        processStartedRef.current.delete(item.id);
        void runProcessing(item.id);
      } else {
        setError(data.error ?? `Upload failed for ${file.name}`);
      }
    }
    setUploading(false);
  }, [storageReady, runProcessing]);

  function handleImportConfirmed(id: string, _summary: ImportSummary) {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: "CONFIRMED" } : u))
    );
  }

  const reviewItem = uploads.find((u) => u.id === reviewId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Upload Center</h1>

      {!storageReady && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTitle>Storage not configured</AlertTitle>
          <AlertDescription>
            Uploads require Cloudflare R2 (or S3) credentials on Render. Set STORAGE_ENDPOINT,
            STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, and STORAGE_BUCKET on both the web service and
            worker, then redeploy. See docs/render.md.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle>Upload Documents</CardTitle></CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-fk-border p-8"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.files); }}
          >
            <p className="text-fk-muted">Drag & drop bank screenshots, credit card statements, or PDFs</p>
            <p className="mt-1 text-xs text-fk-muted">
              Upload → Analyzing → Review → Confirm and recalculate
            </p>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.csv,.heic"
              multiple
              className="mt-4"
              disabled={!storageReady || uploading}
              onChange={(e) => onDrop(e.target.files)}
            />
            {uploading && <p className="mt-2 text-sm text-fk-gold">Uploading…</p>}
            {error && <p className="mt-2 text-sm text-fk-risk-red">{error}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Upload Queue</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {uploads.length === 0 && <p className="text-fk-muted">No uploads yet.</p>}
          {uploads.map((u) => {
            const isProcessing = processingIds.has(u.id) || PROCESSING_STATUSES.has(u.status);
            return (
              <div key={u.id} className="flex items-center justify-between border-b border-fk-border py-2 text-sm">
                <div>
                  <p>{u.fileName}</p>
                  <p className="text-xs text-fk-muted">
                    {u.institution ?? "Unknown institution"}
                    {u.documentType ? ` · ${u.documentType.replace(/_/g, " ").toLowerCase()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      u.status === "CONFIRMED"
                        ? "success"
                        : u.status === "REVIEW_REQUIRED"
                          ? "warning"
                          : "outline"
                    }
                  >
                    {isProcessing && u.status !== "REVIEW_REQUIRED"
                      ? "Analyzing…"
                      : STATUS_LABELS[u.status] ?? u.status}
                  </Badge>
                  {u.status === "REVIEW_REQUIRED" && (
                    <Button size="sm" variant="outline" onClick={() => setReviewId(u.id)}>
                      Review extracted data
                    </Button>
                  )}
                  {PROCESSING_STATUSES.has(u.status) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          processStartedRef.current.delete(u.id);
                          void runProcessing(u.id);
                        }}
                      >
                        Retry
                      </Button>
                      <Button size="sm" onClick={() => setReviewId(u.id)}>
                        Review now
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {reviewId && reviewItem && (
        <UploadReviewPanel
          documentId={reviewId}
          fileName={reviewItem.fileName}
          uploadStatus={reviewItem.status}
          accounts={accounts}
          onClose={() => setReviewId(null)}
          onConfirmed={(summary) => handleImportConfirmed(reviewId, summary)}
        />
      )}
    </div>
  );
}
