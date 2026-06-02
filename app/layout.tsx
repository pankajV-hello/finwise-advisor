import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinWise AI — Your Personal Financial Advisor",
  description:
    "AI-powered financial advisor with tax planning, investment advice, mortgage analysis, and bookkeeping.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
