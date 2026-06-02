import { DISCLAIMER_SECTIONS, TERMS_VERSION, COMPANY_NAME } from "@/lib/legal";

export const metadata = { title: "Terms of Service — FinWise AI" };

export default function TermsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Version {TERMS_VERSION} · Last updated {new Date().getFullYear()}</p>
      </div>

      <div className="glass-card p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          By creating an account and using {COMPANY_NAME} ("the Service"), you agree to these Terms of Service.
          If you do not agree, do not use the Service.
        </p>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-5">
          <h2 className="font-semibold mb-2">Acceptance & Eligibility</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You must be at least 18 years old and capable of forming a binding contract. You agree to provide
            accurate information and to use the Service lawfully.
          </p>
        </div>

        <div className="glass-card p-5">
          <h2 className="font-semibold mb-2">Nature of the Service</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {COMPANY_NAME} is an educational and informational tool only. It does not provide personal financial,
            tax, investment, or legal advice, and does not create any professional or fiduciary relationship. See
            our full Disclaimer for details, which forms part of these Terms.
          </p>
        </div>

        {DISCLAIMER_SECTIONS.map((s) => (
          <div key={s.title} className="glass-card p-5">
            <h2 className="font-semibold mb-2">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}

        <div className="glass-card p-5">
          <h2 className="font-semibold mb-2">Account & Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are responsible for keeping your login credentials secure. Do not enter bank passwords, card
            numbers, or government identifiers into chat fields. Notify us of any unauthorised access.
          </p>
        </div>

        <div className="glass-card p-5">
          <h2 className="font-semibold mb-2">Termination</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You may delete your account at any time. We may suspend or terminate access for breach of these Terms
            or unlawful use.
          </p>
        </div>

        <div className="glass-card p-5">
          <h2 className="font-semibold mb-2">Governing Law</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These Terms are governed by the laws applicable in your country of residence among the jurisdictions
            we serve (Australia, New Zealand, Canada, United States).
          </p>
        </div>
      </div>
    </div>
  );
}
