'use client';

import { useState, useCallback } from 'react';
import AgentChat from './AgentChat';

/**
 * Collapsible chat panel that slides in from the right side of the viewport.
 * Includes a toggle button (rendered in the header) and the chat panel overlay.
 */
export function AgentToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Ask Agent"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        background: '#3182ce',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#2b6cb0';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#3182ce';
      }}
    >
      {/* Chat icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      Ask Agent
    </button>
  );
}

export default function AgentChatPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <AgentToggleButton onClick={toggle} />

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.2)',
            zIndex: 999,
          }}
        />
      )}

      {/* Slide-in panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: '100vw',
          background: '#fff',
          boxShadow: isOpen ? '-4px 0 24px rgba(0,0,0,0.15)' : 'none',
          zIndex: 1000,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isOpen && <AgentChat onClose={close} />}
      </div>
    </>
  );
}
