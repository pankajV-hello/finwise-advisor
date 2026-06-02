import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-sky flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg brand-gradient">FinWise AI</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-12">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="flex gap-4 justify-center mb-2">
          <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/legal/disclaimer" className="hover:text-foreground">Disclaimer</Link>
        </div>
        © {new Date().getFullYear()} FinWise AI · finwiseai-advisor.com
      </footer>
    </div>
  );
}
