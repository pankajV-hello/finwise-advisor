import Link from "next/link";
import {
  Sparkles, Shield, TrendingUp, Receipt, Home, BookOpen,
  ArrowRight, CheckCircle, FileText, Link2
} from "lucide-react";

export default function LandingPage() {
  const features = [
    { icon: Receipt, label: "Tax Advisor", desc: "T4, RRSP, TFSA, capital gains — CRA & IRS expertise", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
    { icon: TrendingUp, label: "Financial Advice", desc: "Investment strategy, retirement planning, wealth building", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
    { icon: Home, label: "Mortgage Advisor", desc: "Amortization, refinancing, stress test, rate comparisons", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
    { icon: BookOpen, label: "AI Bookkeeper", desc: "Expenses, income, P&L reports, tax-deductible tracking", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
    { icon: FileText, label: "Document Analysis", desc: "Upload bank statements, pay slips, tax forms — auto-extracted by AI", color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/20" },
    { icon: Link2, label: "Bank Connect", desc: "Live bank feeds via Plaid — 12,000+ banks in Canada & US", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-dark to-gold flex items-center justify-center shadow-lg shadow-gold/20">
              <Sparkles className="w-4 h-4 text-navy-950" />
            </div>
            <span className="font-display font-bold text-lg gold-gradient">FinWise AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/auth/signup" className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all font-medium">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-24">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          Powered by Claude claude-sonnet-4-6
        </div>

        <div className="flex items-center gap-2 justify-center mb-4 flex-wrap">
          {["🇦🇺 Australia", "🇳🇿 New Zealand", "🇨🇦 Canada", "🇺🇸 USA"].map(c => (
            <span key={c} className="text-xs px-3 py-1 rounded-full bg-secondary border border-border/60 text-muted-foreground">{c}</span>
          ))}
        </div>

        <h1 className="text-5xl md:text-6xl font-display font-bold leading-tight max-w-3xl mb-6">
          Your Personal
          <span className="block gold-gradient">AI Financial Advisor</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mb-10">
          Tax (ATO · IRD · CRA · IRS), superannuation, KiwiSaver, mortgages,
          investments, and bookkeeping — tailored to your country, in one platform.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-navy-950 bg-gradient-to-r from-gold-dark via-gold to-gold-light hover:brightness-110 transition-all shadow-lg shadow-gold/20"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-border hover:bg-accent transition-all"
          >
            Sign in to dashboard
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap gap-6 justify-center text-xs text-muted-foreground">
          {["Bank-grade encryption", "ATO · IRD · CRA · IRS", "12,000+ banks supported", "AU · NZ · CA · US"].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <div className="text-center mb-12">
          <p className="text-xs text-primary uppercase tracking-widest font-semibold mb-2">Everything you need</p>
          <h2 className="text-3xl font-display font-bold">One platform, complete financial clarity</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.label} className="glass-card p-5 hover:border-border/80 transition-all duration-300 group">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${f.bg}`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="font-semibold mb-1.5">{f.label}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-green-400" />
          <span>Your data is encrypted and never shared. FinWise AI is not a registered financial advisor.</span>
        </div>
        <p>Always consult a licensed professional for major financial decisions.</p>
      </footer>
    </div>
  );
}
