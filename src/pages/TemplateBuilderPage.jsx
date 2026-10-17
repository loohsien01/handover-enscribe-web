import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import * as api from '@/lib/api';
import Auth from '@/components/Auth.jsx';
import SectionCard from '@/components/SectionCard.jsx';
import SectionEditPanel from '@/components/SectionEditPanel.jsx';
import SearchNoteTemplateSectionOverlay from '@/components/SearchNoteTemplateSectionOverlay.jsx';
import { logNoteTemplateSectionsClassification } from '@/utils/noteTemplateSectionClassificationDebug.js';

/**
 * Unified Template Builder Page
 * Handles both creating new templates and editing existing ones
 * Mode is determined by presence of :id param
 * Can also receive template data via location.state for creating a copy
 */
export default function TemplateBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = !!id;
  const templateToCopy = location.state?.templateData;
  /** 'llm-extract' skips the " (Copy)" suffix on the default template name. */
  const createTemplateSource = location.state?.createTemplateSource;

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // State
  const [templateName, setTemplateName] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState('');
  const [cachedSections, setCachedSections] = useState(null);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isSystemGenerated, setIsSystemGenerated] = useState(false);
  const [showSystemTemplateAlert, setShowSystemTemplateAlert] = useState(false);
  const [templateData, setTemplateData] = useState(null);

  // Get selected section object
  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  // Load template on mount (edit mode) or load copy template data from location state
  useEffect(() => {
    if (isEditMode) {
      // Load template for editing
      const loadTemplate = async () => {
        const jwt = api.getJWT();
        if (!jwt) {
          navigate('/login');
          return;
        }

        try {
          const result = await api.fetchWithRefreshRetry(
            `/api/note-templates/complete/${id}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          if (!result.success) {
            if (result.status === 401) {
              navigate('/login');
            } else if (result.status === 404) {
              setError('Template not found');
            } else {
              setError(result.error || 'Failed to load template');
            }
            setLoading(false);
            return;
          }

          const data = await result.response.json();
          
          // Check if this is a system-generated template
          const isSystem = data.template.user_id === null;
          setIsSystemGenerated(isSystem);
          
          if (isSystem) {
            // Store template data for potential copy creation
            setTemplateData(data);
            setShowSystemTemplateAlert(true);
          }
          
          setTemplateName(data.template.name);
          // Mark all loaded sections as existing (not new)
          const loadedSections = (data.sections || []).map((section) => ({
            ...section,
            isNew: false,
          }));
          setSections(loadedSections);
          setLoading(false);
        } catch (err) {
          setError(err.message || 'An error occurred while loading the template');
          setLoading(false);
        }
      };

      loadTemplate();
    } else if (templateToCopy) {
      // Load template data from location state for creating a copy
      try {
        const baseName = templateToCopy.template?.name?.trim() || '';
        if (createTemplateSource === 'llm-extract') {
          setTemplateName(baseName || 'AI Generated Template');
        } else {
          setTemplateName(baseName ? `${baseName} (Copy)` : 'Untitled (Copy)');
        }
        // Mark all sections as new so they'll be created as new sections
        const copiedSections = (templateToCopy.sections || []).map((section) => ({
          ...section,
          id: uuidv4(), // Generate new IDs for copied sections
          isNew: true,
        }));
        setSections(copiedSections);
        setLoading(false);
      } catch (err) {
        setError('Failed to load template data for copying');
        setLoading(false);
      }
    }
  }, [id, isEditMode, navigate, templateToCopy, createTemplateSource]);

  // Fetch and cache all note sections on page load
  useEffect(() => {
    const fetchSections = async () => {
      setIsLoadingSections(true);
      try {
        const result = await api.getAllNoteSections();
        if (result.success) {
          const rows = result.data || [];
          logNoteTemplateSectionsClassification(
            'TemplateBuilderPage before setCachedSections (mount fetch)',
            rows
          );
          setCachedSections(rows);
        } else {
          console.error('Failed to fetch sections:', result.error);
          setCachedSections([]);
        }
      } catch (err) {
        console.error('Error fetching sections:', err);
        setCachedSections([]);
      } finally {
        setIsLoadingSections(false);
      }
    };

    fetchSections();
  }, []);

  // Handle template name change
  const handleTemplateName = (value) => {
    setTemplateName(value);
    setError('');
  };

  // Handle section selection
  const handleSelectSection = (sectionId) => {
    setSelectedSectionId(sectionId);
  };

  // Handle section update
  const handleUpdateSection = (updatedSection) => {
    setSections((prev) =>
      prev.map((s) => (s.id === updatedSection.id ? updatedSection : s))
    );
  };

  // Handle creating new section
  const handleAddNewSection = () => {
    const newSection = {
      id: uuidv4(),
      name: '',
      layout: 'full_width',
      details: '',
      user_id: undefined,
      isNew: true,
    };
    setSections((prev) => [...prev, newSection]);
    setSelectedSectionId(newSection.id);
  };

  // Handle deleting section
  const handleDeleteSection = (sectionId) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  };

  // Handle adding section from overlay
  const handleAddSectionFromOverlay = (section) => {
    setSections((prev) => [...prev, section]);
    setSelectedSectionId(section.id);
    setIsSearchOverlayOpen(false);
  };

  // Handle drag end for reordering
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((s) => s.id === active.id);
        const newIndex = items.findIndex((s) => s.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle saving template
  const handleSaveTemplate = async () => {
    // Check if trying to save a system-generated template
    if (isSystemGenerated) {
      setError('Cannot edit system-generated templates. Use "Create a Copy" to create an editable version.');
      return;
    }

    // Validation
    if (!templateName.trim()) {
      setError('Please enter a template name');
      return;
    }

    if (sections.length === 0) {
      setError('Please add at least one section to the template');
      return;
    }

    // Check for invalid sections (empty names)
    const invalidSection = sections.find(
      (s) => !s.name || s.name.trim().length === 0
    );
    if (invalidSection) {
      setError('All sections must have a name');
      return;
    }

    // Check for sections missing layout
    const sectionMissingLayout = sections.find(
      (s) => !s.layout || s.layout.trim().length === 0
    );
    if (sectionMissingLayout) {
      setError('All sections must have a layout selected');
      return;
    }

    // Check for sections missing details
    const sectionMissingDetails = sections.find(
      (s) => !s.details || s.details.trim().length === 0
    );
    if (sectionMissingDetails) {
      setError('All sections must have details');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const jwt = api.getJWT();
      if (!jwt) {
        navigate('/login');
        return;
      }

      // Build sections array for API
      // Platform-owned rows (user_id === null) are shared catalog sections; sending their id
      // makes PATCH treat them as "update existing" and mutates everyone's standard sections.
      // Always create user-owned copies for those (name/layout/details only, no id).
      const sectionsPayload = sections.map((section) => {
        const isPlatformOwnedSection =
          Object.prototype.hasOwnProperty.call(section, 'user_id') &&
          section.user_id === null;

        if (section.isNew || isPlatformOwnedSection) {
          return {
            name: section.name,
            layout: section.layout,
            details: section.details,
          };
        }
        const { id: localId, sourceId, isNew, user_id, created_at, updated_at, ...sectionData } =
          section;
        const apiId = sourceId || localId;
        return { id: apiId, ...sectionData };
      });

      const payload = {
        name: templateName.trim(),
        sections: sectionsPayload,
      };

      // Choose endpoint based on mode
      const endpoint = isEditMode
        ? `/api/note-templates/complete/${id}`
        : '/api/note-templates/complete';
      const method = isEditMode ? 'PATCH' : 'POST';

      const result = await api.fetchWithRefreshRetry(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!result.success) {
        if (result.status === 401) {
          navigate('/login');
          return;
        }
        setError(result.error || 'Failed to save template');
        return;
      }

      // Success - redirect to templates view
      navigate('/view-templates');
    } catch (err) {
      setError(err.message || 'An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigate('/view-templates');
  };

  // Handle creating a copy of system-generated template
  const handleCreateCopy = () => {
    if (templateData) {
      navigate('/template-builder', {
        state: { templateData },
      });
    }
  };

  if (loading && isEditMode && !templateName) {
    return (
      <>
        <Auth />
        <div className="max-w-8xl mx-auto p-8 flex items-center justify-center h-screen">
          <p className="text-gray-600">Loading template...</p>
        </div>
      </>
    );
  }

  const pageTitle = isEditMode ? 'Edit Template' : 'Create Template';

  return (
    <>
      <Auth />
      <div className="max-w-8xl mx-auto p-4 sm:p-6 lg:p-8 lg:h-screen flex flex-col lg:overflow-hidden">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">{pageTitle}</h1>
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Template name input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => handleTemplateName(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-inset text-lg ${
                error && !templateName.trim()
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="e.g., Initial Appointment"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* System-generated template alert */}
          {showSystemTemplateAlert && isSystemGenerated && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">System Template</h3>
                  <p className="text-sm text-amber-800 mb-3">
                    This is a standard, system-generated template and cannot be edited directly. Create a copy to make your own editable version.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCreateCopy}
                className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                Create a Copy
              </button>
            </div>
          )}
        </div>

        {/* Main content - two column layout */}
        <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
          {/* Left panel — flex-none below lg so it only uses content height; edit panel gets the rest */}
          <div className="flex-none lg:flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Sections ({sections.length})
              </h2>
              <button
                onClick={() => setIsSearchOverlayOpen(true)}
                className="px-4 py-2 mr-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                + Add Section
              </button>
            </div>

            {/* Sections list */}
            <div className="flex-1 flex flex-col min-h-0 gap-4 pr-2">

              {/* Sections list */}
              {sections.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
                  <p className="p-4">No sections added yet. Click "Add Section" to get started.</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex-1 overflow-y-auto space-y-2 max-h-96 lg:max-h-none">
                    {sections.map((section) => (
                      <SectionCard
                        key={section.id}
                        section={section}
                        onSelect={handleSelectSection}
                        onDelete={handleDeleteSection}
                        isDragHandle={true}
                        isSelected={selectedSectionId === section.id}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            </div>

            {/* Save button section */}
            <div className="mt-4 mr-2">
              <button
                onClick={handleSaveTemplate}
                disabled={loading || isSystemGenerated}
                className={`w-full px-6 py-3 text-white font-medium rounded-lg transition-colors ${
                  isSystemGenerated
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400'
                }`}
              >
                {loading ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>

          {/* Right panel — flex-1 below lg fills remaining viewport under sections + save */}
          <div className="w-full lg:w-2/5 flex-1 lg:flex-none flex flex-col bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200 overflow-hidden min-h-0 lg:min-h-110">
            <SectionEditPanel
              selectedSection={selectedSection}
              onUpdateSection={handleUpdateSection}
              onAddNewSection={handleAddNewSection}
            />
          </div>
        </div>
      </div>

      {/* Search/Add section overlay */}
      <SearchNoteTemplateSectionOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        onAddSection={handleAddSectionFromOverlay}
        cachedSections={cachedSections}
        setCachedSections={setCachedSections}
        isLoadingSections={isLoadingSections}
        setIsLoadingSections={setIsLoadingSections}
      />
    </>
  );
}
