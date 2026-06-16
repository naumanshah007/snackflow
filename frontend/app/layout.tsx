import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnackFlow — Distribution Management System for Zaib Brothers",
  description: "Carton-first stock, sales, shop ledger, payment collection, and warehouse control for snack distribution teams.",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
