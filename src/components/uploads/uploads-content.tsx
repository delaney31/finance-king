"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function UploadsContent({ initialUploads }: { initialUploads: UploadItem[] }) {
  const [uploads, setUploads] = useState(initialUploads);
  const [uploading, setUploading] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const onDrop = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/uploads", { method: "POST", body: form });
      if (res.ok) {
        const doc = await res.json();
        setUploads((prev) => [doc, ...prev]);
      }
    }
    setUploading(false);
  }, []);

  async function confirmUpload(id: string) {
    await fetch(`/api/v1/uploads/${id}/confirm`, { method: "POST" });
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: "CONFIRMED" } : u)));
    setReviewId(null);
  }

  const reviewItem = uploads.find((u) => u.id === reviewId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Upload Center</h1>

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
              onChange={(e) => onDrop(e.target.files)}
            />
            {uploading && <p className="mt-2 text-sm text-fk-gold">Uploading...</p>}
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
