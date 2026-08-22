'use client';

import { useState, useEffect, useCallback } from 'react';
import { listOutreach, createOutreach } from '@/lib/opportunities-api';
import type { OutreachRecord } from '@/lib/opportunities-api';

type Channel = 'email' | 'sms' | 'direct_mail';

const CHANNEL_CONFIG: Record<
  Channel,
  { label: string; icon: string; color: string }
> = {
  email: { label: 'Email', icon: '\u2709', color: '#3b82f6' },
  sms: { label: 'SMS', icon: '\uD83D\uDCF1', color: '#8b5cf6' },
  direct_mail: { label: 'Direct Mail', icon: '\uD83D\uDCEC', color: '#f59e0b' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  sent: { bg: '#f3f4f6', text: '#6b7280' },
  delivered: { bg: '#dbeafe', text: '#2563eb' },
  replied: { bg: '#dcfce7', text: '#16a34a' },
  bounced: { bg: '#fee2e2', text: '#dc2626' },
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface OutreachPanelProps {
  opportunityId: string;
}

export default function OutreachPanel({ opportunityId }: OutreachPanelProps) {
  const [records, setRecords] = useState<OutreachRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingChannel, setSendingChannel] = useState<Channel | null>(null);
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      const data = await listOutreach(opportunityId);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load outreach records:', err);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadRecords();
  }, [loadRecords]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(loadRecords, 10_000);
    return () => clearInterval(interval);
  }, [loadRecords]);

  async function handleSend() {
    if (!sendingChannel || !recipient.trim()) return;
    setSubmitting(true);
    try {
      await createOutreach({
        opportunity_id: opportunityId,
        channel: sendingChannel,
        recipient: recipient.trim(),
        subject: subject.trim() || undefined,
      });
      setRecipient('');
      setSubject('');
      setSendingChannel(null);
      await loadRecords();
    } catch (err) {
      console.error('Failed to send outreach:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    backgroundColor: '#ffffff',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div>
      {/* Section header */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 10,
          paddingBottom: 4,
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        Outreach Campaigns
      </div>

      {/* Channel send buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(Object.keys(CHANNEL_CONFIG) as Channel[]).map((ch) => {
          const cfg = CHANNEL_CONFIG[ch];
          const isActive = sendingChannel === ch;
          return (
            <button
              key={ch}
              onClick={() => setSendingChannel(isActive ? null : ch)}
              style={{
                padding: '6px 14px',
                backgroundColor: isActive ? cfg.color : '#f3f4f6',
                color: isActive ? '#ffffff' : '#4b5563',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Mini-form when channel selected */}
      {sendingChannel && (
        <div
          style={{
            padding: 12,
            backgroundColor: '#f9fafb',
            borderRadius: 6,
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
            Send {CHANNEL_CONFIG[sendingChannel].label}
          </div>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={
              sendingChannel === 'email'
                ? 'Recipient email'
                : sendingChannel === 'sms'
                  ? 'Phone number'
                  : 'Mailing address'
            }
            style={inputStyle}
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSend}
              disabled={submitting || !recipient.trim()}
              style={{
                padding: '6px 14px',
                backgroundColor:
                  submitting || !recipient.trim() ? '#9ca3af' : '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                cursor:
                  submitting || !recipient.trim() ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {submitting ? 'Sending...' : 'Send'}
            </button>
            <button
              onClick={() => {
                setSendingChannel(null);
                setRecipient('');
                setSubject('');
              }}
              style={{
                padding: '6px 14px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                backgroundColor: '#ffffff',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Outreach history table */}
      {loading ? (
        <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>
          Loading outreach...
        </div>
      ) : records.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>
          No outreach campaigns yet
        </div>
      ) : (
        <div>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 90px 110px 110px',
              gap: 8,
              padding: '6px 0',
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div>Channel</div>
            <div>Recipient</div>
            <div>Status</div>
            <div>Sent</div>
            <div>Updated</div>
          </div>

          {/* Rows */}
          {records.map((rec) => {
            const chCfg =
              CHANNEL_CONFIG[rec.channel as Channel] ?? CHANNEL_CONFIG.email;
            const stCfg = STATUS_COLORS[rec.status] ?? STATUS_COLORS.sent;
            return (
              <div
                key={rec.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 90px 110px 110px',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: 13,
                  alignItems: 'center',
                }}
              >
                <div style={{ color: chCfg.color, fontWeight: 500 }}>
                  {chCfg.icon} {chCfg.label}
                </div>
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: '#1f2937',
                  }}
                  title={rec.subject ? `${rec.recipient} - ${rec.subject}` : rec.recipient}
                >
                  {rec.recipient}
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: stCfg.bg,
                      color: stCfg.text,
                    }}
                  >
                    {rec.status}
                  </span>
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {formatTimestamp(rec.sent_at)}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {formatTimestamp(rec.status_updated_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
