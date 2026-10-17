import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Reusable section card component for template builder
 * Displays section name, type badge, and action buttons
 * Integrates with dnd-kit for drag and drop
 */
export default function SectionCard({
  section,
  onSelect,
  onDelete,
  isDragHandle = true,
  isSelected = false,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const getOwnerLabel = (section) => {
    return section.user_id === null ? "Standard" : "Custom";
  };

  const getBadgeColor = (section) => {
    if (section.user_id === null) {
      return { bg: '#d1fae5', text: '#065f46' }; // green
    }
    return { bg: '#dbeafe', text: '#0c4a6e' }; // blue
  };

  const badgeColor = getBadgeColor(section);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        // Don't select if clicking delete button or drag handle
        if (e.target.closest('[data-action="delete"]') || e.target.closest('[data-action="drag"]')) {
          return;
        }
        onSelect?.(section.id);
      }}
      className={`
        relative rounded-lg cursor-pointer transition-all h-fit
        ${isSelected ? 'border border-blue-500 bg-blue-50' : 'border border-gray-200 bg-white'}
        ${isDragging ? 'bg-blue-100 border border-blue-400' : ''}
        hover:shadow-md
        p-3
      `}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Drag handle */}
        {isDragHandle && (
          <div
            data-action="drag"
            {...attributes}
            {...listeners}
            style={{ touchAction: 'none' }}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
            title="Drag to reorder"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 16">
              <path d="M9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm4-8h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2z" />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {section.name}
          </div>
        </div>

        {/* Badge - right-aligned before buttons */}
        <div
          className="flex-shrink-0"
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: '500',
            backgroundColor: badgeColor.bg,
            color: badgeColor.text,
            whiteSpace: 'nowrap',
          }}
        >
          {getOwnerLabel(section)}
        </div>

        {/* Action buttons */}
        <div className="flex-shrink-0 flex gap-1">
          {/* Delete button */}
          {onDelete && (
            <button
              data-action="delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(section.id);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
              title="Remove section from template"
              aria-label="Delete section"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
