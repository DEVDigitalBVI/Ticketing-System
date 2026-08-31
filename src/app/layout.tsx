import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Peter Island Resort and Spa IT Service Desk",
    template: "%s | Peter Island Resort and Spa IT Service Desk",
  },
  description: "The application shell for the Peter Island Resort and Spa IT Service Desk.",
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
