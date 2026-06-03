"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  Briefcase,
  Receipt,
  TrendingUp,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { ExtractedDocument } from "@/lib/documents/extract";

interface UploadedFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  result?: {
    document: Record<string, unknown>;
    extracted?: ExtractedDocument;
    transactionsImported: number;
    fieldsUpdated?: string[];
  };
  error?: string;
}

const DOC_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  bank_statement: {
    label: "Bank Statement",
    icon: Building2,
    color: "text-blue-600",
  },
  salary_slip: {
    label: "Salary / Pay Slip",
    icon: Briefcase,
    color: "text-green-600",
  },
  t4: { label: "T4 Slip", icon: Receipt, color: "text-amber-500" },
  t1: { label: "T1 Return", icon: Receipt, color: "text-amber-500" },
  w2: { label: "W-2 Form", icon: Receipt, color: "text-orange-500" },
  "1040": { label: "1040 Tax Return", icon: Receipt, color: "text-orange-500" },
  investment_statement: {
    label: "Investment Statement",
    icon: TrendingUp,
    color: "text-purple-600",
  },
  mortgage_statement: {
    label: "Mortgage Statement",
    icon: Home,
    color: "text-pink-400",
  },
  receipt: { label: "Receipt", icon: Receipt, color: "text-muted-foreground" },
  other: {
    label: "Financial Document",
    icon: FileText,
    color: "text-muted-foreground",
  },
};

function getFileIcon(file: File) {
  if (file.type === "application/pdf") return FileText;
  if (file.type.startsWith("image/")) return Image;
  return FileSpreadsheet;
}

function ExtractionResult({
  extracted,
  transactionsImported,
  fieldsUpdated,
}: {
  extracted: ExtractedDocument;
  transactionsImported: number;
  fieldsUpdated?: string[];
}) {
  const config = DOC_TYPE_CONFIG[extracted.documentType] || DOC_TYPE_CONFIG.other;
  const Icon = config.icon;

  return (
    <div className="mt-3 p-3 rounded-lg bg-accent/50 border border-border/60 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4", config.color)} />
        <span className="text-xs font-medium">{config.label}</span>
        {extracted.institution && (
          <Badge variant="secondary" className="text-[10px] h-4">
            {extracted.institution}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{extracted.summary}</p>

      {/* Income details */}
      {extracted.incomeDetails && (
        <div className="grid grid-cols-3 gap-2">
          {extracted.incomeDetails.grossPay !== undefined && (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Gross Pay</div>
              <div className="text-xs font-semibold text-green-600">
                {formatCurrency(extracted.incomeDetails.grossPay)}
              </div>
            </div>
          )}
          {extracted.incomeDetails.taxDeducted !== undefined && (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Tax Deducted</div>
              <div className="text-xs font-semibold text-red-500">
                {formatCurrency(extracted.incomeDetails.taxDeducted)}
              </div>
            </div>
          )}
          {extracted.incomeDetails.netPay !== undefined && (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Net Pay</div>
              <div className="text-xs font-semibold text-foreground">
                {formatCurrency(extracted.incomeDetails.netPay)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tax details */}
      {extracted.taxDetails && (
        <div className="grid grid-cols-3 gap-2">
          {extracted.taxDetails.totalIncome !== undefined && (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Total Income</div>
              <div className="text-xs font-semibold">
                {formatCurrency(extracted.taxDetails.totalIncome)}
              </div>
            </div>
          )}
          {extracted.taxDetails.taxOwing !== undefined &&
          extracted.taxDetails.taxOwing >= 0 ? (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Tax Owing</div>
              <div className="text-xs font-semibold text-red-500">
                {formatCurrency(extracted.taxDetails.taxOwing)}
              </div>
            </div>
          ) : null}
          {extracted.taxDetails.refundOwing !== undefined &&
          extracted.taxDetails.refundOwing > 0 ? (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Refund</div>
              <div className="text-xs font-semibold text-green-600">
                {formatCurrency(extracted.taxDetails.refundOwing)}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Transaction import */}
      {transactionsImported > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle className="w-3.5 h-3.5" />
          {transactionsImported} transactions imported to Bookkeeper
        </div>
      )}

      {/* Fields auto-filled */}
      {fieldsUpdated && fieldsUpdated.length > 0 && (
        <div className="flex items-start gap-1.5 text-xs text-primary border-t border-border/40 pt-2 mt-1">
          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Auto-filled your profile —{" "}
            {fieldsUpdated
              .map((f) =>
                f.includes("annual_income") ? "income" :
                f.includes("tax_profile.tax_paid") ? "tax paid" :
                f.includes("tax_profile") ? "tax profile" :
                f.includes("accounts") ? "investment account" :
                f.includes("transactions") ? f : f
              )
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(" · ")}
            . Check your Dashboard & Tax Advisor.
          </span>
        </div>
      )}
    </div>
  );
}

interface DocumentUploaderProps {
  onUploaded?: () => void;
}

export function DocumentUploader({ onUploaded }: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (newFiles: File[]) => {
      const uploads: UploadedFile[] = newFiles.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "pending",
      }));

      setFiles((prev) => [...uploads, ...prev]);

      for (const upload of uploads) {
        setFiles((prev) =>
          prev.map((u) =>
            u.id === upload.id ? { ...u, status: "uploading" } : u
          )
        );

        try {
          const formData = new FormData();
          formData.append("file", upload.file);

          const res = await fetch("/api/documents/upload", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) throw new Error(data.error || "Upload failed");

          setFiles((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? { ...u, status: "done", result: data }
                : u
            )
          );

          onUploaded?.();
        } catch (err) {
          setFiles((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? {
                    ...u,
                    status: "error",
                    error:
                      err instanceof Error ? err.message : "Upload failed",
                  }
                : u
            )
          );
        }
      }
    },
    [onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length) processFiles(dropped);
    },
    [processFiles]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) processFiles(selected);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/60 hover:border-border hover:bg-accent/30"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx"
          onChange={onInputChange}
          className="sr-only"
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "w-14 h-14 rounded-2xl border flex items-center justify-center transition-colors",
              isDragging
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-accent border-border text-muted-foreground"
            )}
          >
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Drop financial documents here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              "Bank Statement",
              "Salary Slip",
              "T4 / W-2",
              "T1 / 1040",
              "Investment Statement",
              "Receipts",
              "CSV Export",
            ].map((type) => (
              <span
                key={type}
                className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground"
              >
                {type}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            PDF, JPG, PNG, CSV · Max 20MB per file
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((upload) => {
            const FileIcon = getFileIcon(upload.file);
            return (
              <div
                key={upload.id}
                className="glass-card p-4 animate-slide-up"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent border border-border flex items-center justify-center shrink-0">
                    <FileIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {upload.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(upload.file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {upload.status === "uploading" && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analyzing...
                          </div>
                        )}
                        {upload.status === "done" && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        {upload.status === "error" && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(upload.id);
                          }}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {upload.status === "error" && (
                      <p className="text-xs text-red-500 mt-1">
                        {upload.error}
                      </p>
                    )}

                    {upload.status === "done" && upload.result?.extracted && (
                      <ExtractionResult
                        extracted={upload.result.extracted}
                        transactionsImported={
                          upload.result.transactionsImported
                        }
                        fieldsUpdated={upload.result.fieldsUpdated}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
