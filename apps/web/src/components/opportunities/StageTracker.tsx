'use client';

import { useState } from 'react';
import type { OpportunityStage, HistoryRecord } from '@/lib/opportunities-api';

interface StageTrackerProps {
  currentStage: OpportunityStage;
  history: HistoryRecord[];
  onAdvanceStage?: (stage: OpportunityStage, note: string) => void;
}

const PIPELINE_STAGES: OpportunityStage[] = [
  'identified',
  'contacted',
  'negotiating',
  'under_contract',
  'closed',
];

const stageLabels: Record<OpportunityStage, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  under_contract: 'Under Contract',
  closed: 'Closed',
  dead: 'Dead',
};

const stageColors: Record<string, string> = {
  identified: '#9ca3af',
  contacted: '#3b82f6',
  negotiating: '#eab308',
  under_contract: '#f97316',
  closed: '#22c55e',
  dead: '#ef4444',
};

function formatDateTime(value: string | null): string {
  if (!value) return '--';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function StageTracker({
  currentStage,
  history,
  onAdvanceStage,
}: StageTrackerProps) {
  const [modalStage, setModalStage] = useState<OpportunityStage | null>(null);
  const [note, setNote] = useState('');

  const currentIdx = PIPELINE_STAGES.indexOf(currentStage);
  const isDead = currentStage === 'dead';

  function handleStageClick(stage: OpportunityStage) {
    if (!onAdvanceStage) return;
    if (stage === currentStage) return;
    // Allow clicking future stages or dead
    setModalStage(stage);
    setNote('');
  }

  function handleConfirm() {
    if (modalStage && onAdvanceStage) {
      onAdvanceStage(modalStage, note);
      setModalStage(null);
      setNote('');
    }
  }

  return (
    <div>
      {/* Pipeline stages */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          marginBottom: 12,
        }}
      >
        {PIPELINE_STAGES.map((stage, idx) => {
          const isCompleted = !isDead && idx < currentIdx;
          const isCurrent = stage === currentStage;
          const isFuture = !isDead && idx > currentIdx;
          const color = stageColors[stage];

          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Stage circle */}
              <div
                onClick={() =>
                  (isFuture || stage === 'dead') && handleStageClick(stage)
                }
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor:
                    isFuture || stage === 'dead' ? 'pointer' : 'default',
                  backgroundColor: isCurrent
                    ? color
                    : isCompleted
                      ? color
                      : '#f3f4f6',
                  color:
                    isCurrent || isCompleted ? '#ffffff' : '#9ca3af',
                  border: isCurrent
                    ? `3px solid ${color}`
                    : isCompleted
                      ? 'none'
                      : '2px solid #d1d5db',
                  opacity: isDead ? 0.4 : 1,
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                title={stageLabels[stage]}
              >
                {isCompleted ? '\u2713' : idx + 1}
              </div>
              {/* Connector line */}
              {idx < PIPELINE_STAGES.length - 1 && (
                <div
                  style={{
                    width: 32,
                    height: 3,
                    backgroundColor:
                      isCompleted && !isDead ? color : '#e5e7eb',
                    transition: 'background-color 0.2s',
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Dead branch */}
        <div
          style={{
            marginLeft: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              width: 20,
              height: 2,
              backgroundColor: isDead ? '#ef4444' : '#e5e7eb',
              transform: 'rotate(-30deg)',
            }}
          />
          <div
            onClick={() => !isDead && handleStageClick('dead')}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              cursor: isDead ? 'default' : 'pointer',
              backgroundColor: isDead ? '#ef4444' : '#f3f4f6',
              color: isDead ? '#ffffff' : '#d1d5db',
              border: isDead ? '3px solid #ef4444' : '2px solid #d1d5db',
              transition: 'all 0.2s',
            }}
            title="Dead"
          >
            X
          </div>
        </div>
      </div>

      {/* Stage labels below */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: 16,
        }}
      >
        {PIPELINE_STAGES.map((stage, idx) => (
          <div
            key={stage}
            style={{
              width: idx < PIPELINE_STAGES.length - 1 ? 68 : 36,
              textAlign: 'center',
              fontSize: 10,
              color:
                stage === currentStage
                  ? stageColors[stage]
                  : '#9ca3af',
              fontWeight: stage === currentStage ? 700 : 400,
              flexShrink: 0,
            }}
          >
            {stageLabels[stage]}
          </div>
        ))}
        <div
          style={{
            marginLeft: 16,
            width: 52,
            textAlign: 'center',
            fontSize: 10,
            color: isDead ? '#ef4444' : '#9ca3af',
            fontWeight: isDead ? 700 : 400,
          }}
        >
          Dead
        </div>
      </div>

      {/* Stage advance modal */}
      {modalStage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setModalStage(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 24,
              width: 400,
              maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1f2937' }}>
              Change Stage
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
              Moving from{' '}
              <strong>{stageLabels[currentStage]}</strong> to{' '}
              <strong style={{ color: stageColors[modalStage] }}>
                {stageLabels[modalStage]}
              </strong>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this stage change..."
              style={{
                width: '100%',
                minHeight: 80,
                padding: 10,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                onClick={() => setModalStage(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  backgroundColor: stageColors[modalStage],
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage history */}
      {history.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            Stage History
          </div>
          <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: 12 }}>
            {history.map((entry) => (
              <div key={entry.id} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  {entry.from_stage && (
                    <>
                      <span
                        style={{
                          color: stageColors[entry.from_stage] ?? '#6b7280',
                          fontWeight: 600,
                        }}
                      >
                        {stageLabels[entry.from_stage as OpportunityStage] ??
                          entry.from_stage}
                      </span>
                      <span style={{ color: '#9ca3af' }}>&rarr;</span>
                    </>
                  )}
                  <span
                    style={{
                      color: stageColors[entry.to_stage] ?? '#6b7280',
                      fontWeight: 600,
                    }}
                  >
                    {stageLabels[entry.to_stage as OpportunityStage] ??
                      entry.to_stage}
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>
                {entry.note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#4b5563',
                      marginTop: 2,
                      fontStyle: 'italic',
                    }}
                  >
                    {entry.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
