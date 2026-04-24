import type { Metadata } from "next";
import "./globals.css";
import "@schedule-x/theme-default/dist/index.css";
import { Toaster } from "sileo";

export const metadata: Metadata = {
  title: "Cymple",
  description: "Cymple, gestiona tu agenda profesional de forma simple.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          options={{
            fill: "#171717",
            styles: {
              title: "color: #fafafa",
              description: "color: #a1a1aa",
            },
          }}
        />
      </body>
    </html>
  );
}
