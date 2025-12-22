import type { Metadata } from "next";
import { Inter } from "next/font/google";
// ↓↓↓ 关键！这一行决定了有没有样式 ↓↓↓
import "./globals.css"; 
// ↑↑↑ 必须指向刚才新建的那个文件 ↑↑↑

import { AuthProvider } from "@/context/AuthContext";
import Layout from "@/components/Layout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hytzer EHS System",
  description: "Hytzer EHS 管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AuthProvider>
          <Layout>
            {children}
          </Layout>
        </AuthProvider>
      </body>
    </html>
  );
}