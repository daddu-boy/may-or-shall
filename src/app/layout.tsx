import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";

/**
 * One display face, used only for titles. The body stays on the system sans:
 * the contrast between a high contrast serif headline and plain sans text is
 * what makes an editorial page feel considered rather than decorated.
 * Self hosted by next/font, so no request leaves the page.
 */
const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

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
    <html lang="en" className={display.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
