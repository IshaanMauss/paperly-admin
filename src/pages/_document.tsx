import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content="#f5f3ff" />
        <link rel="icon" href="/favicon.ico?v=2026-10-03" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico?v=2026-10-03" />
        <link rel="icon" href="/favicon.svg?v=2026-10-03" type="image/svg+xml" />
        <link rel="icon" href="/icon-192.png?v=2026-10-03" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icon-512.png?v=2026-10-03" type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=2026-10-03" />
        <link rel="manifest" href="/site.webmanifest?v=2026-10-03" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
