import React, { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

/** Returns a copy of `list` with the item at `from` moved to `to`. */
export function moveItem(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Drag-and-drop reordering for a list of rows. Only the grip handle starts a drag, so inputs inside a row stay
 * selectable. Spread `handleProps(i)` on a <DragHandle/> and `rowProps(i)` on the row; `onMove(from, to)` fires on drop.
 */
export function useDragReorder(onMove, { disabled = false } = {}) {
  const fromRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);

  const reset = () => {
    fromRef.current = null;
    setDragging(null);
    setOver(null);
  };

  const handleProps = (index) => ({
    draggable: !disabled,
    onDragStart: (e) => {
      if (disabled) return;
      fromRef.current = index;
      setDragging(index);
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', String(index));
        // Drag the whole row, not just the little grip.
        const row = e.currentTarget.closest('[data-drag-row]');
        if (row) e.dataTransfer.setDragImage(row, 16, 16);
      } catch {
        /* some browsers refuse setData/setDragImage — the drag still works */
      }
    },
    onDragEnd: reset
  });

  const rowProps = (index) => ({
    'data-drag-row': '',
    onDragOver: (e) => {
      if (fromRef.current === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== index) setOver(index);
    },
    onDrop: (e) => {
      e.preventDefault();
      const from = fromRef.current;
      reset();
      if (from !== null && from !== index) onMove(from, index);
    }
  });

  /** Extra classes for a row: faded while it is being dragged, marked where it would land (`table` for <tr>, which can't take a ring). */
  const rowClass = (index, { table = false } = {}) =>
    dragging === index
      ? 'opacity-40'
      : dragging !== null && over === index
        ? table
          ? 'bg-indigo-100/70 dark:bg-indigo-950/50'
          : 'ring-2 ring-indigo-400 ring-offset-1'
        : '';

  return { handleProps, rowProps, rowClass, isDragging: dragging !== null };
}

/** The grip a row is dragged by. */
export function DragHandle({ disabled = false, title = 'Drag to reorder', className = '', ...rest }) {
  return (
    <span
      title={disabled ? 'Clear the search to reorder' : title}
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-[color:var(--text-muted)] ${
        disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:text-indigo-600 hover:bg-[color:var(--bg-subtle)]'
      } ${className}`}
      {...rest}
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );
}
