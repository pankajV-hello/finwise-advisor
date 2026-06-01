import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FileText, Link2, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { BankConnect } from "@/components/documents/bank-connect";
import { DocumentLibrary } from "@/components/documents/document-library";

export default async function DocumentsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: documents }, { data: connections }] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bank_connections")
      .select("*")
      .eq("user_id", user.id),
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Documents & Connections"
        description="Upload financial documents for AI analysis or connect your bank accounts"
        icon={<FileText className="w-5 h-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upload */}
        <div className="space-y-5">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <UploadCloud className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Upload Documents</h2>
            </div>
            <DocumentUploader />
          </div>
        </div>

        {/* Right: Bank connections */}
        <div className="space-y-5">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Bank Connections</h2>
            </div>
            <BankConnect connections={connections || []} />
          </div>
        </div>
      </div>

      {/* Document library */}
      {documents && documents.length > 0 && (
        <div className="mt-6 glass-card p-5">
          <h2 className="font-semibold text-sm mb-4">Document Library</h2>
          <DocumentLibrary documents={documents} />
        </div>
      )}
    </div>
  );
}
