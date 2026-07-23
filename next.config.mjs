/** @type {import('next').NextConfig} */
const nextConfig = {
  // self-contained server build, used by the desktop app (desktop/)
  output: "standalone",
  experimental: {
    // pdf.js is imported dynamically on the server for text extraction;
    // keep it external so webpack doesn't try to bundle its worker.
    serverComponentsExternalPackages: ["pdfjs-dist"],
  },
};

export default nextConfig;
