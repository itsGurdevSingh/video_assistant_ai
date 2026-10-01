import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Assistant",
  description: "Search, understand, and discuss your videos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
