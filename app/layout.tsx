import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter" 
});

const merriweather = Merriweather({ 
  weight: ["300", "400", "700"], 
  subsets: ["latin"], 
  variable: "--font-merriweather" 
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${merriweather.variable}`}>
      <body className="flex h-screen bg-slate-900 text-slate-200 font-sans antialiased overflow-hidden">
        
        <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-[#FF8C69]">PeachyNotes</h1>
          </div>
          
          <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
            <Link href="/dashboard" className="p-3 rounded-lg hover:bg-slate-800 hover:text-white transition">
              Dashboard
            </Link>
            <Link href="/materials" className="p-3 rounded-lg hover:bg-slate-800 hover:text-white transition">
              Materials
            </Link>
            <Link href="/search" className="p-3 rounded-lg hover:bg-slate-800 hover:text-white transition">
              Search
            </Link>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto bg-slate-900 p-8">
          {children}
        </main>
        
      </body>
    </html>
  );
}
