import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Eye, EyeOff, RotateCcw, LayoutDashboard,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import { WIDGET_META } from '../../lib/widgetConfig';
import { useWidgetLayout } from '../../hooks/useWidgetLayout';

// ─── Toggle switch (matches reference design) ─────────────────────────────────
function Toggle({ on, onChange, label }) {
  return (
    <button
      onClick={onChange}
      className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
      style={{ backgroundColor: on ? 'var(--accent-color)' : 'var(--bg-card-hover)' }}
      aria-label={`${on ? 'Hide' : 'Show'} ${label}`}
      aria-checked={on}
      role="switch"
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

// ─── Sortable row (desktop — dnd-kit) ─────────────────────────────────────────
function SortableRow({ widget, onToggle }) {
  const meta = WIDGET_META[widget.id] || { label: widget.id, description: '' };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-3 py-3.5 group"
      style={{
        ...style,
        borderBottom: '1px solid var(--border-subtle)',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="p-1 rounded cursor-grab active:cursor-grabbing transition-opacity opacity-30 group-hover:opacity-70 shrink-0"
        style={{ touchAction: 'none' }}
        aria-label="Drag to reorder"
      >
        <GripVertical size={15} style={{ color: 'var(--text-secondary)' }} />
      </div>

      {/* Visibility icon */}
      <div className="shrink-0" style={{ color: widget.visible ? 'var(--accent-color)' : 'var(--text-tertiary)' }}>
        {widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: widget.visible ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
          {meta.label}
        </p>
        {meta.description && (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
            {meta.description}
          </p>
        )}
      </div>

      {/* Toggle */}
      <Toggle on={widget.visible} onChange={() => onToggle(widget.id)} label={meta.label} />
    </div>
  );
}

// ─── Mobile row (up/down arrows, no drag) ─────────────────────────────────────
function MobileRow({ widget, index, total, onToggle, onMoveUp, onMoveDown }) {
  const meta = WIDGET_META[widget.id] || { label: widget.id, description: '' };

  return (
    <div className="flex items-center gap-3 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Move arrows */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 rounded transition-opacity disabled:opacity-20"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Move up"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-1 rounded transition-opacity disabled:opacity-20"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Move down"
        >
          <ChevronDown size={13} />
        </button>
      </div>

      {/* Visibility icon */}
      <div className="shrink-0" style={{ color: widget.visible ? 'var(--accent-color)' : 'var(--text-tertiary)' }}>
        {widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: widget.visible ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
          {meta.label}
        </p>
      </div>

      {/* Toggle */}
      <Toggle on={widget.visible} onChange={() => onToggle(widget.id)} label={meta.label} />
    </div>
  );
}

// ─── Main settings section ────────────────────────────────────────────────────
export default function DashboardLayoutSettings() {
  const { widgets, toggleWidget, reorderWidgets, resetToDefault } = useWidgetLayout();
  const [confirmReset, setConfirmReset] = useState(false);

  // ── dnd-kit sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    reorderWidgets(arrayMove(widgets, oldIndex, newIndex));
  }

  function handleMoveUp(index) {
    if (index === 0) return;
    reorderWidgets(arrayMove(widgets, index, index - 1));
  }

  function handleMoveDown(index) {
    if (index === widgets.length - 1) return;
    reorderWidgets(arrayMove(widgets, index, index + 1));
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    resetToDefault();
    setConfirmReset(false);
  }

  const visibleCount = widgets.filter((w) => w.visible).length;

  return (
    <div className="card p-5 space-y-4">
      {/* Section header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <LayoutDashboard size={14} style={{ color: 'var(--accent-color)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Dashboard Layout
            </h2>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {visibleCount} of {widgets.length} widgets visible.{' '}
            <span className="hidden md:inline">Drag to reorder on desktop, use arrows on mobile.</span>
            <span className="inline md:hidden">Use arrows to reorder.</span>
            {' '}Preferences saved automatically.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0"
          style={{
            backgroundColor: confirmReset ? 'var(--danger-color)' : 'var(--bg-card-hover)',
            color: confirmReset ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${confirmReset ? 'var(--danger-color)' : 'var(--border-subtle)'}`,
          }}
          title="Reset to default layout"
        >
          <RotateCcw size={11} />
          {confirmReset ? 'Confirm reset?' : 'Reset'}
        </button>
      </div>

      {/* Desktop — dnd-kit sortable list */}
      <div className="hidden md:block">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <div>
              {widgets.map((widget) => (
                <SortableRow
                  key={widget.id}
                  widget={widget}
                  onToggle={toggleWidget}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Mobile — arrow reorder */}
      <div className="block md:hidden">
        {widgets.map((widget, i) => (
          <MobileRow
            key={widget.id}
            widget={widget}
            index={i}
            total={widgets.length}
            onToggle={toggleWidget}
            onMoveUp={() => handleMoveUp(i)}
            onMoveDown={() => handleMoveDown(i)}
          />
        ))}
      </div>

      <p className="text-[11px] pt-1" style={{ color: 'var(--text-tertiary)' }}>
        Tip: Widgets toggled off make no API calls — useful on slow connections.
      </p>
    </div>
  );
}
