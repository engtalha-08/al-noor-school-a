import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR — School Management System",
  description:
    "Centralised school management system for AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR: students, attendance, fees, examinations and parent communication.",
  icons: { icon: "/images/logo.png", apple: "/images/logo.png" },
};

const themeScript = `(function(){try{var t=localStorage.getItem('alnoor-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
