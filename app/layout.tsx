import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

// Material Symbols is absent from next/font/google's manifest, so it loads from
// the Google Fonts stylesheet. `icon_names` subsets it to only the glyphs used
// here, and `display=block` avoids rendering the ligature text as literal words.
const MATERIAL_SYMBOLS_HREF =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0" +
  "&icon_names=close,dark_mode,description,light_mode,menu,person,progress_activity,refresh,send,smart_toy" +
  "&display=block";

// Runs before paint so a dark-mode reload never flashes the light palette.
const THEME_INIT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`;

export const metadata: Metadata = {
  title: "RAG Agent Chat",
  description: "Chat with your Google Drive documents, with page-level citations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
