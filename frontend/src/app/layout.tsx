import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClassPilot AI — Coaching Management",
  description: "Students, fees, attendance aur AI insights — ek glassmorphism dashboard me.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body>{children}</body>
    </html>
  );
}
