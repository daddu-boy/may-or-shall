import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "May or Shall",
  description: "Read once, use everywhere — a workspace for litigation matters",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
