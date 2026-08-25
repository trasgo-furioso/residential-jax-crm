import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';

const NavigationGuard = nextDynamic(() => import('@/components/NavigationGuard'), {
  ssr: false,
});
const NotificationBell = nextDynamic(() => import('@/components/notifications/NotificationBell'), {
  ssr: false,
});
const AgentChatPanel = nextDynamic(() => import('@/components/agent/AgentChatPanel'), {
  ssr: false,
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Residential Property Acquisition CRM',
  description: 'Jacksonville FL residential property acquisition CRM',
};

const navItems = [
  { href: '/', label: 'Map / Dashboard' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/notifications', label: 'Notifications' },
];

const placeholderItems = [
  { label: 'Disposition' },
  { label: 'Portfolio Tracking' },
  { label: 'Live Messaging' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`.nav-link:hover { background-color: #2a2a4a; }`}</style>
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <NavigationGuard />
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
                    className="nav-link"
                    style={{
                      display: 'block',
                      padding: '10px 20px',
                      color: '#c0c0d0',
                      textDecoration: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              {/* Placeholder items */}
              <li
                style={{
                  borderTop: '1px solid #2a2a4a',
                  marginTop: 12,
                  paddingTop: 12,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    padding: '0 20px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#5a5a7a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Coming Soon
                </span>
              </li>
              {placeholderItems.map((item) => (
                <li key={item.label}>
                  <span
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 20px',
                      color: '#5a5a7a',
                      fontSize: 14,
                      fontWeight: 500,
                      opacity: 0.6,
                      cursor: 'not-allowed',
                    }}
                  >
                    {item.label}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 8,
                        backgroundColor: '#2a2a4a',
                        color: '#8888aa',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Soon
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </nav>

          {/* Main content area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Top header bar */}
            <header
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '8px 24px',
                backgroundColor: '#fff',
                borderBottom: '1px solid #e5e7eb',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AgentChatPanel />
                <NotificationBell />
              </div>
            </header>
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
        </div>
      </body>
    </html>
  );
}
