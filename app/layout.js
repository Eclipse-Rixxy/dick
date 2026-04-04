import './globals.css';

export const metadata = {
  title: 'CloudSINT — OSINT Intelligence Platform',
  description: 'Open source intelligence platform. Username, email, IP, domain, phone, and Discord reconnaissance.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
