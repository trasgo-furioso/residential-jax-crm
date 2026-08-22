import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Residential Property Acquisition CRM',
  description: 'Jacksonville FL residential property acquisition CRM',
};

const navItems = [
  { href: '/', label: 'Map / Dashboard' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/notifications', label: 'Notifications' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Sidebar */}
          <nav
            style={{
              width: 240,
              flexShrink: 0,
              backgroundColor: '#1a1a2e',
              color: '#e0e0e0',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 0',
            }}
          >
            <div
              style={{
                padding: '0 20px 24px',
                borderBottom: '1px solid #2a2a4a',
                marginBottom: 16,
              }}
            >
              <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                JAX Property CRM
              </h1>
              <span style={{ fontSize: 12, color: '#8888aa' }}>
                Residential Acquisitions
              </span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    style={{
                      display: 'block',
                      padding: '10px 20px',
                      color: '#c0c0d0',
                      textDecoration: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.backgroundColor = '#2a2a4a';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Main content area */}
          <main
            style={{
              flex: 1,
              backgroundColor: '#f5f5f7',
              padding: 24,
              overflowY: 'auto',
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
