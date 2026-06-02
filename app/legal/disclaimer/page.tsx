import { DISCLAIMER_SECTIONS, GENERAL_ADVICE_WARNING, TERMS_VERSION } from "@/lib/legal";
import { ShieldAlert } from "lucide-react";

export const metadata = { title: "Disclaimer — FinWise AI" };

export default function DisclaimerPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-medium mb-4">
          <ShieldAlert className="w-3.5 h-3.5" /> Important — please read
        </div>
        <h1 className="text-3xl font-display font-bold mb-2">Disclaimer</h1>
        <p className="text-sm text-muted-foreground">Version {TERMS_VERSION} · Last updated {new Date().getFullYear()}</p>
      </div>

      <div className="space-y-6">
        {DISCLAIMER_SECTIONS.map((s) => (
          <div key={s.title} className="glass-card p-5">
            <h2 className="font-semibold mb-2">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-display font-bold mb-4">Country-Specific Notices</h2>
        <div className="space-y-3">
          {Object.entries(GENERAL_ADVICE_WARNING).map(([country, text]) => (
            <div key={country} className="rounded-xl border border-amber-300/60 bg-amber-50 p-4">
              <div className="text-xs font-semibold text-amber-800 mb-1.5">
                {country === "AU" ? "🇦🇺 Australia" : country === "NZ" ? "🇳🇿 New Zealand" : country === "CA" ? "🇨🇦 Canada" : "🇺🇸 United States"}
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
