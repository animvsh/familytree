import { Geist, Geist_Mono } from "next/font/google";
import Link from 'next/link'; // Make sure to import Link
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
  title: "A Map of Everyone", // Updated title
  description: "Mapping relationships across the globe", // Updated description
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <Link href="/" className="hover:text-gray-300 text-lg font-semibold">
              A Map of Everyone
            </Link>
            <div>
              <Link href="/dashboard" className="mr-4 hover:text-gray-300">Dashboard</Link>
              <Link href="/login" className="mr-4 hover:text-gray-300">Login</Link>
              <Link href="/register" className="hover:text-gray-300">Register</Link>
            </div>
          </div>
        </nav>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
