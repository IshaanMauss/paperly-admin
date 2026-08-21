import type { AppProps } from "next/app";
import { AdminAuthProvider } from "@/lib/adminAuth";
import "@/styles/globals.css";
import "katex/dist/katex.min.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AdminAuthProvider>
      <Component {...pageProps} />
    </AdminAuthProvider>
  );
}
