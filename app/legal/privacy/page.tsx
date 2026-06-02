import { PRIVACY_SECTIONS, TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy Policy — FinWise AI" };

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Version {TERMS_VERSION} · Last updated {new Date().getFullYear()}</p>
      </div>

      <div className="glass-card p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your privacy matters. This policy explains what we collect, how we use it, and your rights under the
          Privacy Act 1988 (AU), Privacy Act 2020 (NZ), PIPEDA (CA), and CCPA (US).
        </p>
      </div>

      <div className="space-y-6">
        {PRIVACY_SECTIONS.map((s) => (
          <div key={s.title} className="glass-card p-5">
            <h2 className="font-semibold mb-2">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
