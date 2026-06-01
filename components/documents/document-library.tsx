"use client";

import { useState } from "react";
import {
  FileText,
  Image,
  FileSpreadsheet,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Building2,
  Briefcase,
  Receipt,
  TrendingUp,
  Home,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  bank_statement: Building2,
  salary_slip: Briefcase,
  t4: Receipt,
  t1: Receipt,
  w2: Receipt,
  "1040": Receipt,
  investment_statement: TrendingUp,
  mortgage_statement: Home,
  receipt: Receipt,
  other: FileText,
};

const DOC_TYPE_LABELS: Record<string, string> = {
  bank_statement: "Bank Statement",
  salary_slip: "Salary Slip",
  t4: "T4 Slip",
  t1: "T1 Return",
  w2: "W-2 Form",
  "1040": "1040 Return",
  investment_statement: "Investment Statement",
  mortgage_statement: "Mortgage Statement",
  receipt: "Receipt",
  other: "Document",
};

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  document_type?: string;
  institution?: string;
  period_start?: string;
  period_end?: string;
  analysis_summary?: string;
  status: string;
  created_at: string;
  extracted_data?: Record<string, unknown>;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "done":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="w-3 h-3" />
          Analyzed
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="warning" className="gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
  }
}

export function DocumentLibrary({ documents }: { documents: Document[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    setDeleting(id);
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const DocIcon =
          DOC_TYPE_ICONS[doc.document_type || "other"] || FileText;
        const isExpanded = expanded === doc.id;

        return (
          <div
            key={doc.id}
            className="border border-border/60 rounded-lg overflow-hidden"
          >
            <div
              className="flex items-center gap-3 p-3 hover:bg-accent/30 cursor-pointer transition-colors"
              onClick={() => setExpanded(isExpanded ? null : doc.id)}
            >
              <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center shrink-0">
                <DocIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate max-w-xs">
                    {doc.file_name}
                  </p>
                  {doc.document_type && (
                    <Badge variant="secondary" className="text-[10px]">
                      {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                    </Badge>
                  )}
                  {doc.institution && (
                    <span className="text-xs text-muted-foreground">
                      · {doc.institution}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(doc.created_at)}
                  {doc.period_start && doc.period_end && (
                    <>
                      {" · "}
                      {formatDate(doc.period_start)} –{" "}
                      {formatDate(doc.period_end)}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={doc.status} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id);
                  }}
                  disabled={deleting === doc.id}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-red-400 transition-colors"
                >
                  {deleting === doc.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {isExpanded && doc.analysis_summary && (
              <div className="px-4 pb-4 pt-0 border-t border-border/40">
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  {doc.analysis_summary}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
