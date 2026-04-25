import type { Metadata } from "next";
import "./globals.css";
import "@schedule-x/theme-default/dist/index.css";
import { Toaster } from "sileo";
import { DM_Sans, Outfit, Poppins, Roboto } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mid",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-data",
  display: "swap",
});

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
    <html
      lang="es"
      className={`h-full antialiased ${dmSans.variable} ${outfit.variable} ${poppins.variable} ${roboto.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Saltar al contenido
        </a>
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          options={{
            fill: "#181e25",
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
