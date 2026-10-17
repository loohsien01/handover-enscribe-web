import React, { useState } from 'react';
import Select from '@/components/Select.jsx';
import { DEFAULT_LAYOUT } from '@/constants/layoutTypes';

/**
 * Section Edit Panel (right side)
 * Shows editing form for selected section
 * Fields: name, layout, details
 */
export default function SectionEditPanel({
  selectedSection,
  onUpdateSection,
  onAddNewSection,
}) {
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  if (!selectedSection) {
    return (
      <div className="flex flex-col h-full min-h-0 gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Edit Section</h2>
        <div className="flex-1 flex items-center justify-center text-gray-400 min-h-[8rem]">
          <p>Select a section to edit</p>
        </div>
      </div>
    );
  }

  const isNameEmpty =
    !selectedSection.name || selectedSection.name.trim().length === 0;
  const isDetailsEmpty =
    !selectedSection.details || selectedSection.details.trim().length === 0;

  const handleChange = (field, value) => {
    setAttemptedSubmit(false);
    onUpdateSection({
      ...selectedSection,
      [field]: value,
    });
  };


  return (
    <div className="flex flex-col h-full min-h-0 gap-4 lg:max-h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">Edit Section</h2>
          {selectedSection.isNew && (
            <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded shrink-0">
              New
            </span>
          )}
        </div>
      </div>

      {/* Form — scrolls inside parent; parent height comes from TemplateBuilder flex layout on small screens */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
        {/* Section Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Section Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={selectedSection.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-inset ${
              isNameEmpty
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            placeholder="e.g., Chief Complaint"
          />
        </div>

        {/* Layout */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Layout
          </label>
          <Select
            value={selectedSection.layout || DEFAULT_LAYOUT}
            onChange={(e) => handleChange('layout', e.target.value)}
            className="focus:ring-blue-500"
          >
            <option value="bullet points">Bullet Points</option>
            <option value="paragraph">Paragraph</option>
          </Select>
        </div>

        {/* Details */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Details <span className="text-red-500">*</span>
          </label>
          <textarea
            value={selectedSection.details || ''}
            onChange={(e) => handleChange('details', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-inset font-mono text-sm ${
              isDetailsEmpty
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            placeholder="Enter placeholder text or instructions for this section..."
            rows={8}
          />
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="font-medium mb-2 text-black">💡 Tips:</p>
          <div className="space-y-2 text-xs">
            <div>
              <p className="font-medium text-black mt-1">Content Placeholders</p>
              <p className="text-gray-500">Use square brackets - Enscribe will try to add the content specified.</p>
              <p><span className="text-gray-500">e.g. </span><span className="text-green-700 italic">[Mention any allergies the patient has]</span></p>
            </div>
            <div>
              <p className="font-medium text-black mt-1">Instructions</p>
              <p className="text-gray-500">Use parentheses for instructions.</p>
              <p><span className="text-gray-500">e.g. </span><span className="text-blue-700 italic">(Only include PLAN if explicitly mentioned)</span></p>
            </div>
            <div>
              <p className="font-medium text-black mt-1">Verbatim Text</p>
              <p className="text-gray-500">Use double asterisks for verbatim text.</p>
              <p><span className="text-gray-500">e.g. </span><span className="text-purple-700 italic">«Instructed patient on treatment plan»</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
