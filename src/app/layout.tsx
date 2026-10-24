import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter: same face observed in the Aprova product (computed font-family in the model environment).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Aprova · Implantação",
  description: "Validação dos processos-modelo com a prefeitura.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        <footer className="foot">Os dados utilizados nesta demonstração são fictícios.</footer>
      </body>
    </html>
  );
}
