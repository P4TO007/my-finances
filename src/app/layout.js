export const metadata = {
  title: "Mis Finanzas",
  description: "Registra tus ingresos y gastos fácilmente",
  manifest: "/manifest.json",
  themeColor: "#6366f1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mis Finanzas",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Mis Finanzas" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0f1117" }}>
        {children}
      </body>
    </html>
  );
}
