'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { agentChat, type AgentProperty, type AgentResponse } from '@/lib/agent-api';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  properties?: AgentProperty[];
  loading?: boolean;
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function PropertyCard({ property }: { property: AgentProperty }) {
  return (
    <a
      href={`/?parcel=${encodeURIComponent(property.parcel_id)}`}
      style={{
        display: 'block',
        padding: '10px 12px',
        margin: '6px 0',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#3182ce';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
        {property.address_street}, {property.address_city} {property.address_zip}
      </div>
      <div style={{ fontSize: 12, color: '#555', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>Parcel: {property.parcel_id}</span>
        <span>Assessed: {formatCurrency(property.assessed_value)}</span>
        <span>Roof: {property.roof_age_years}yr</span>
        <span>Tenure: {property.ownership_tenure_years}yr</span>
      </div>
      {property.provenance_sources && (
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          Sources: {property.provenance_sources}
        </div>
      )}
    </a>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#94a3b8',
            animation: `agentPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes agentPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </span>
  );
}

export default function AgentChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    const loadingMsg: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'agent',
      text: '',
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const result: AgentResponse = await agentChat(text);
      const responseText =
        !result.response && (!result.properties || result.properties.length === 0)
          ? 'No matching properties found. Try adjusting your search criteria or asking about a different area.'
          : result.response;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                text: responseText,
                properties: result.properties,
                loading: false,
              }
            : m,
        ),
      );
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : 'An error occurred';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, text: `Error: ${errorText}`, loading: false }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e2e2',
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 15 }}>Property Agent</div>
        <button
          onClick={onClose}
          aria-label="Close agent chat"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            padding: '2px 6px',
            color: '#666',
          }}
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#999', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Ask questions about properties in Jacksonville.
            <br />
            <span style={{ fontSize: 12, fontStyle: 'italic' }}>
              Try: &quot;Show distressed properties in Arlington with roofs older than 15 years&quot;
            </span>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? '#3182ce' : '#f1f5f9',
                color: msg.role === 'user' ? '#fff' : '#1a1a1a',
                fontSize: 13,
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {msg.loading ? (
                <LoadingDots />
              ) : (
                <>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  {msg.properties && msg.properties.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {msg.properties.map((p) => (
                        <PropertyCard key={p.parcel_id} property={p} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #e2e2e2',
          flexShrink: 0,
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about properties..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 13,
            outline: 'none',
            background: isLoading ? '#f9fafb' : '#fff',
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          style={{
            padding: '10px 18px',
            background: isLoading || !inputValue.trim() ? '#94a3b8' : '#3182ce',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
