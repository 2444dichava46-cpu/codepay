import "./globals.css";

export const metadata = {
  title: "Code Pay",
  description: "Encontre quem transforma código em solução.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
