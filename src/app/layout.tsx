import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "CompuCash Lite",
  description: "Restorani kassasüsteem",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et">
      <body className="min-h-dvh antialiased">
        <Nav />
        <main className="mx-auto max-w-screen-2xl px-3 py-4 sm:px-5 sm:py-6 print:p-0">{children}</main>
      </body>
    </html>
  );
}
