"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatMoney } from "@/lib/utils/money";

interface UploadItem {
  id: string;
  fileName: string;
  status: string;
  institution: string | null;
  createdAt: string;
  extractionResult?: {
    extractedData: Record<string, unknown>;
    fieldConfidence: Record<string, number>;
  } | null;
}

const PROCESSING_STATUSES = new Set(["PENDING", "PROCESSING"]);

export function UploadsContent({
  initialUploads,
  storageReady,
}: {
  initialUploads: UploadItem[];
  storageReady: boolean;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = uploadsRef.current.filter((u) => PROCESSING_STATUSES.has(u.status));
      if (pending.length === 0) return;

      const updates = await Promise.all(
        pending.map(async (u) => {
          const res = await fetch(`/api/v1/uploads/${u.id}`);
          if (!res.ok) return u;
          return (await res.json()) as UploadItem;
        })
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
  }, []);

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
      const res = await fetch("/api/v1/uploads", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUploads((prev) => [data as UploadItem, ...prev]);
      } else {
        setError(data.error ?? `Upload failed for ${file.name}`);
      }
    }
    setUploading(false);
  }, [storageReady]);

  async function confirmUpload(id: string) {
    await fetch(`/api/v1/uploads/${id}/confirm`, { method: "POST" });
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: "CONFIRMED" } : u)));
    setReviewId(null);
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
            <p className="text-fk-muted">Drag & drop PNG, JPG, PDF, or CSV files</p>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.csv,.heic"
              multiple
              className="mt-4"
              disabled={!storageReady || uploading}
              onChange={(e) => onDrop(e.target.files)}
            />
            {uploading && <p className="mt-2 text-sm text-fk-gold">Uploading...</p>}
            {error && <p className="mt-2 text-sm text-fk-risk-red">{error}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Upload Queue</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {uploads.length === 0 && <p className="text-fk-muted">No uploads yet.</p>}
          {uploads.map((u) => (
            <div key={u.id} className="flex items-center justify-between border-b border-fk-border py-2 text-sm">
              <div>
                <p>{u.fileName}</p>
                <p className="text-xs text-fk-muted">{u.institution ?? "Unknown institution"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.status === "CONFIRMED" ? "success" : u.status === "REVIEW_REQUIRED" ? "warning" : "outline"}>
                  {u.status}
                </Badge>
                {u.status === "REVIEW_REQUIRED" && (
                  <Button size="sm" variant="outline" onClick={() => setReviewId(u.id)}>Review</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {reviewItem?.extractionResult && (
        <Card className="border-fk-gold/40">
          <CardHeader><CardTitle>Review Extraction — {reviewItem.fileName}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(reviewItem.extractionResult.fieldConfidence).map(([field, conf]) => (
              <div key={field} className="flex justify-between text-sm">
                <span>{field}</span>
                <Badge variant={conf < 0.7 ? "warning" : "success"}>{(conf * 100).toFixed(0)}% confidence</Badge>
              </div>
            ))}
            {"balance" in (reviewItem.extractionResult.extractedData as object) && (
              <p>Balance: {formatMoney(Number((reviewItem.extractionResult.extractedData as { balance?: { value: string } }).balance?.value ?? 0))}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => confirmUpload(reviewItem.id)}>Confirm & Save</Button>
              <Button variant="outline" onClick={() => setReviewId(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
