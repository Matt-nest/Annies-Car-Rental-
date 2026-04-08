import { useState, useCallback } from 'react';
import { DEFAULT_LAYOUT, WIDGET_REGISTRY } from '../lib/widgetConfig';

const STORAGE_KEY = 'annie_dashboard_layout_v2';

/**
 * Load from localStorage and merge with the canonical registry.
 * This handles the case where new widgets are added after a user saved
 * their preferences — new widgets appear at the end with their default visibility.
 */
function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT;

    // Merge: keep saved prefs, append any brand-new widget ids at the end
    const savedIds = new Set(parsed.map((w) => w.id));
    const merged = [...parsed.filter((w) => WIDGET_REGISTRY.some((r) => r.id === w.id))];

    for (const reg of WIDGET_REGISTRY) {
      if (!savedIds.has(reg.id)) {
        merged.push({ id: reg.id, visible: reg.defaultVisible, order: merged.length });
      }
    }

    return merged;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function persistLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // localStorage unavailable — fail silently, state still works in memory
  }
}

/**
 * Hook that manages widget layout state with localStorage persistence.
 *
 * Returns:
 *  widgets        — ordered array of { id, visible, order }
 *  toggleWidget   — flip a widget's visibility
 *  reorderWidgets — replace the ordered array wholesale (from dnd-kit / arrows)
 *  resetToDefault — restore factory defaults
 */
export function useWidgetLayout() {
  const [widgets, setWidgets] = useState(loadLayout);

  const toggleWidget = useCallback((id) => {
    setWidgets((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
      persistLayout(next);
      return next;
    });
  }, []);

  const reorderWidgets = useCallback((newOrder) => {
    persistLayout(newOrder);
    setWidgets(newOrder);
  }, []);

  const resetToDefault = useCallback(() => {
    persistLayout(DEFAULT_LAYOUT);
    setWidgets(DEFAULT_LAYOUT);
  }, []);

  return { widgets, toggleWidget, reorderWidgets, resetToDefault };
}
