'use client';

import { useState, useEffect, useCallback } from 'react';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import StageTracker from '@/components/opportunities/StageTracker';
import {
  listOpportunities,
  getOpportunityById,
  updateOpportunityStage,
  updateOpportunityDetails,
  createTask,
  toggleTask,
} from '@/lib/opportunities-api';
import type {
  OpportunityRecord,
  OpportunityDetail,
  OpportunityStage,
  OpportunityFilters,
} from '@/lib/opportunities-api';
import OutreachPanel from '@/components/opportunities/OutreachPanel';

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Stages' },
  { value: 'identified', label: 'Identified' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'closed', label: 'Closed' },
  { value: 'dead', label: 'Dead' },
];

const stageColors: Record<string, string> = {
  identified: '#9ca3af',
  contacted: '#3b82f6',
  negotiating: '#eab308',
  under_contract: '#f97316',
  closed: '#22c55e',
  dead: '#ef4444',
};

function formatCurrency(value: string | null): string {
  if (!value) return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [stageFilter, setStageFilter] = useState('');
  const [zipFilter, setZipFilter] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  // Inline edit state for details
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // New task state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const filters: OpportunityFilters = {};
      if (stageFilter) filters.stage = stageFilter;
      if (zipFilter) filters.zip = zipFilter;
      if (minScoreFilter) filters.min_score = Number(minScoreFilter);
      if (dateFromFilter) filters.date_from = dateFromFilter;
      if (dateToFilter) filters.date_to = dateToFilter;

      const data = await listOpportunities(
        Object.keys(filters).length > 0 ? filters : undefined,
      );
      setOpportunities(data);
    } catch (err) {
      console.error('Failed to load opportunities:', err);
    } finally {
      setLoading(false);
    }
  }, [stageFilter, zipFilter, minScoreFilter, dateFromFilter, dateToFilter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await getOpportunityById(id);
      setDetail(data);
    } catch (err) {
      console.error('Failed to load opportunity detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  async function handleStageAdvance(stage: OpportunityStage, note: string) {
    if (!detail) return;
    try {
      await updateOpportunityStage({
        id: detail.id,
        stage,
        note: note || undefined,
      });
      await loadDetail(detail.id);
      await loadOpportunities();
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  }

  async function handleSaveField(field: string) {
    if (!detail) return;
    try {
      const updateData: Record<string, unknown> = { id: detail.id };
      if (field === 'asking_price' || field === 'offer_amount') {
        updateData[field] = editValue ? Number(editValue) : undefined;
      } else {
        updateData[field] = editValue || undefined;
      }
      await updateOpportunityDetails(
        updateData as Parameters<typeof updateOpportunityDetails>[0],
      );
      setEditingField(null);
      await loadDetail(detail.id);
      await loadOpportunities();
    } catch (err) {
      console.error('Failed to update detail:', err);
    }
  }

  async function handleCreateTask() {
    if (!detail || !newTaskTitle.trim()) return;
    try {
      await createTask({
        opportunity_id: detail.id,
        title: newTaskTitle.trim(),
        assignee: newTaskAssignee || undefined,
        due_date: newTaskDueDate || undefined,
      });
      setNewTaskTitle('');
      setNewTaskAssignee('');
      setNewTaskDueDate('');
      setShowTaskForm(false);
      await loadDetail(detail.id);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  }

  async function handleToggleTask(taskId: string) {
    try {
      await toggleTask(taskId);
      if (detail) await loadDetail(detail.id);
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  }

  // Stage breakdown summary
  const stageCounts = opportunities.reduce<Record<string, number>>(
    (acc, opp) => {
      acc[opp.stage] = (acc[opp.stage] || 0) + 1;
      return acc;
    },
    {},
  );

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    backgroundColor: '#ffffff',
    width: '100%',
    boxSizing: 'border-box',
  };

  function EditableField({
    label,
    field,
    value,
    type = 'text',
  }: {
    label: string;
    field: string;
    value: string | null;
    type?: string;
  }) {
    const isEditing = editingField === field;
    return (
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 11,
            color: '#6b7280',
            marginBottom: 2,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        {isEditing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              autoFocus
            />
            <button
              onClick={() => handleSaveField(field)}
              style={{
                padding: '4px 10px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Save
            </button>
            <button
              onClick={() => setEditingField(null)}
              style={{
                padding: '4px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                backgroundColor: '#fff',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div
            onClick={() => {
              setEditingField(field);
              setEditValue(value ?? '');
            }}
            style={{
              fontSize: 13,
              color: value ? '#1f2937' : '#9ca3af',
              cursor: 'pointer',
              padding: '4px 0',
              borderBottom: '1px dashed #e5e7eb',
            }}
            title="Click to edit"
          >
            {field === 'asking_price' || field === 'offer_amount'
              ? formatCurrency(value) || 'Click to set'
              : value || 'Click to set'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: '#1f2937',
            }}
          >
            Opportunities
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {opportunities.length} total
            {Object.entries(stageCounts).length > 0 && (
              <span style={{ marginLeft: 12 }}>
                {Object.entries(stageCounts)
                  .map(
                    ([stage, count]) =>
                      `${count} ${stage.replace('_', ' ')}`,
                  )
                  .join(' | ')}
              </span>
            )}
          </div>
        </div>
        <a
          href="/"
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          + Add Opportunity
        </a>
      </div>

      {/* Stage summary badges */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {STAGE_OPTIONS.slice(1).map((s) => (
          <div
            key={s.value}
            style={{
              padding: '4px 12px',
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 500,
              backgroundColor:
                stageFilter === s.value
                  ? stageColors[s.value]
                  : '#f3f4f6',
              color:
                stageFilter === s.value ? '#ffffff' : '#4b5563',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onClick={() =>
              setStageFilter(stageFilter === s.value ? '' : s.value)
            }
          >
            {s.label} ({stageCounts[s.value] || 0})
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: '0 0 140px' }}>
          <label
            style={{
              fontSize: 11,
              color: '#6b7280',
              display: 'block',
              marginBottom: 2,
            }}
          >
            Stage
          </label>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={inputStyle}
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '0 0 100px' }}>
          <label
            style={{
              fontSize: 11,
              color: '#6b7280',
              display: 'block',
              marginBottom: 2,
            }}
          >
            ZIP Code
          </label>
          <input
            value={zipFilter}
            onChange={(e) => setZipFilter(e.target.value)}
            placeholder="e.g. 32204"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: '0 0 100px' }}>
          <label
            style={{
              fontSize: 11,
              color: '#6b7280',
              display: 'block',
              marginBottom: 2,
            }}
          >
            Min Score
          </label>
          <input
            type="number"
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(e.target.value)}
            placeholder="0-100"
            min={0}
            max={100}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: '0 0 140px' }}>
          <label
            style={{
              fontSize: 11,
              color: '#6b7280',
              display: 'block',
              marginBottom: 2,
            }}
          >
            Date From
          </label>
          <input
            type="date"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: '0 0 140px' }}>
          <label
            style={{
              fontSize: 11,
              color: '#6b7280',
              display: 'block',
              marginBottom: 2,
            }}
          >
            Date To
          </label>
          <input
            type="date"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Two-panel layout */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          minHeight: 'calc(100vh - 260px)',
        }}
      >
        {/* Left: List */}
        <div
          style={{
            flex: '0 0 340px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 260px)',
          }}
        >
          {loading ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: 14,
              }}
            >
              Loading...
            </div>
          ) : opportunities.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: 14,
              }}
            >
              No opportunities found. Start by creating one from the property
              search.
            </div>
          ) : (
            opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                selected={opp.id === selectedId}
                onClick={() => setSelectedId(opp.id)}
              />
            ))
          )}
        </div>

        {/* Right: Detail */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#ffffff',
            borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: 24,
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 260px)',
          }}
        >
          {!selectedId ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9ca3af',
                fontSize: 14,
              }}
            >
              Select an opportunity to view details
            </div>
          ) : detailLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9ca3af',
                fontSize: 14,
              }}
            >
              Loading...
            </div>
          ) : detail ? (
            <div>
              {/* Header */}
              <div style={{ marginBottom: 20 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#1f2937',
                  }}
                >
                  {detail.parcel_id}
                </h2>
                {detail.owner_name && (
                  <div
                    style={{
                      fontSize: 13,
                      color: '#6b7280',
                      marginTop: 2,
                    }}
                  >
                    Owner: {detail.owner_name}
                  </div>
                )}
              </div>

              {/* Stage Tracker */}
              <div style={{ marginBottom: 24 }}>
                <StageTracker
                  currentStage={detail.stage as OpportunityStage}
                  history={detail.history}
                  onAdvanceStage={handleStageAdvance}
                />
              </div>

              {/* Details Section */}
              <div style={{ marginBottom: 24 }}>
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
                  Details
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0 16px',
                  }}
                >
                  <EditableField
                    label="Email"
                    field="owner_contact_email"
                    value={detail.owner_contact_email}
                    type="email"
                  />
                  <EditableField
                    label="Phone"
                    field="owner_contact_phone"
                    value={detail.owner_contact_phone}
                    type="tel"
                  />
                  <EditableField
                    label="Owner Interest"
                    field="owner_interest"
                    value={detail.owner_interest}
                  />
                  <EditableField
                    label="Asking Price"
                    field="asking_price"
                    value={detail.asking_price}
                    type="number"
                  />
                  <EditableField
                    label="Offer Amount"
                    field="offer_amount"
                    value={detail.offer_amount}
                    type="number"
                  />
                </div>
                <EditableField
                  label="Notes"
                  field="notes"
                  value={detail.notes}
                />
                <EditableField
                  label="Next Steps"
                  field="next_steps"
                  value={detail.next_steps}
                />
              </div>

              {/* Tasks Section */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      paddingBottom: 4,
                      borderBottom: '1px solid #e5e7eb',
                      flex: 1,
                    }}
                  >
                    Tasks
                  </div>
                  <button
                    onClick={() => setShowTaskForm(!showTaskForm)}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      marginLeft: 8,
                    }}
                  >
                    + Add
                  </button>
                </div>

                {showTaskForm && (
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: '#f9fafb',
                      borderRadius: 6,
                      marginBottom: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title"
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={newTaskAssignee}
                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                        placeholder="Assignee"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleCreateTask}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#3b82f6',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Create Task
                      </button>
                      <button
                        onClick={() => setShowTaskForm(false)}
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

                {detail.tasks.length === 0 ? (
                  <div
                    style={{
                      fontSize: 13,
                      color: '#9ca3af',
                      padding: '8px 0',
                    }}
                  >
                    No tasks yet
                  </div>
                ) : (
                  detail.tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 0',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed ?? false}
                        onChange={() => handleToggleTask(task.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: task.completed ? '#9ca3af' : '#1f2937',
                          textDecoration: task.completed
                            ? 'line-through'
                            : 'none',
                        }}
                      >
                        {task.title}
                      </span>
                      {task.assignee && (
                        <span
                          style={{
                            fontSize: 11,
                            color: '#6b7280',
                            backgroundColor: '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {task.assignee}
                        </span>
                      )}
                      {task.due_date && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {task.due_date}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Outreach Campaigns Section (T047) */}
              <div style={{ marginBottom: 24 }}>
                <OutreachPanel opportunityId={detail.id} />
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9ca3af',
                fontSize: 14,
              }}
            >
              Opportunity not found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
