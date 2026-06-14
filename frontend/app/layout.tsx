import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zaib Brothers",
  description: "Smart Stock, Sales & Shop Ledger for Snack Distribution",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
