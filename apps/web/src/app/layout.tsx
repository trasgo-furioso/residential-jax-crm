import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Residential Property Acquisition CRM',
  description: 'Jacksonville FL residential property acquisition CRM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
