
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});


const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export const metadata = {
  title: "LinkSnap — Fast, Minimal URL Shortener",
  description: "Create clean, reliable short links in seconds. A developer-friendly URL shortener built with Next.js and Express.",
};


export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >

      <body className="min-h-screen flex flex-col bg-[#fafaf9] text-[#18181b]">
        {children}
      </body>
    </html>
  );
}

