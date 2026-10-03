import type { Metadata } from "next";
import "./globals.css";
import VersionWatch from "@/components/VersionWatch";

export const metadata: Metadata = {
  title: "May or Shall",
  description: "Save the lines that matter as you read, then let ChatGPT draft from them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <VersionWatch />
      </body>
    </html>
  );
}
