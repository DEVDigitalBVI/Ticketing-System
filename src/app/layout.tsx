import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Peter Island Resort and Spa IT Service Desk",
    template: "%s | Peter Island Resort and Spa IT Service Desk",
  },
  description: "Report and track technology issues at Peter Island Resort and Spa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
