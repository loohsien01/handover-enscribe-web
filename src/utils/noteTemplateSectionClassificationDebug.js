/**
 * Debug helpers for note-template-section list vs SearchNoteTemplateSectionOverlay badge logic.
 * Overlay: "Standard" = platform row (user_id === null per API). "Custom" = everything else (user UUID, drafts, etc.).
 */

function rowUiIsCustom(section) {
  return section?.user_id !== null;
}

/** Strict platform/system row per API (null only; undefined is client draft or omitted). */
function rowBackendPlatformNull(section) {
  return section?.user_id === null;
}

/**
 * @param {unknown} rows
 * @returns {object} summary for console
 */
export function summarizeNoteTemplateSectionsForUi(rows) {
  if (!Array.isArray(rows)) {
    return {
      ok: false,
      reason: 'not-array',
      typeof: typeof rows,
      keys: rows && typeof rows === 'object' ? Object.keys(rows) : null,
    };
  }

  const summary = {
    ok: true,
    total: rows.length,
    backendSystem_nullUserId: 0,
    backendSystem_undefinedUserId: 0,
    backendUser_nonEmptyString: 0,
    backendUser_otherShape: 0,
    uiBadge_Custom: 0,
    uiBadge_Standard: 0,
    /** user_id === null but UI would show Custom (should stay 0 if overlay matches API) */
    platformNull_shownAsCustom: 0,
    /** User UUID row but UI would show Standard (should stay 0) */
    userUuid_shownAsStandard: 0,
    edgeSamples: [],
  };

  for (const s of rows) {
    const uid = s?.user_id;
    const isNew = Boolean(s?.isNew);
    const uiCustom = rowUiIsCustom(s);
    const bePlatformNull = rowBackendPlatformNull(s);

    if (uid === null) summary.backendSystem_nullUserId += 1;
    else if (uid === undefined) summary.backendSystem_undefinedUserId += 1;
    else if (typeof uid === 'string' && uid.length > 0) {
      summary.backendUser_nonEmptyString += 1;
    } else {
      summary.backendUser_otherShape += 1;
      if (summary.edgeSamples.length < 10) {
        summary.edgeSamples.push({
          id: s?.id,
          name: s?.name,
          user_id: uid,
          typeof_user_id: typeof uid,
          isNew,
          uiCustom,
          bePlatformNull,
        });
      }
    }

    if (uiCustom) summary.uiBadge_Custom += 1;
    else summary.uiBadge_Standard += 1;

    if (bePlatformNull && uiCustom) summary.platformNull_shownAsCustom += 1;
    if (typeof uid === 'string' && uid.length > 0 && !uiCustom) {
      summary.userUuid_shownAsStandard += 1;
    }
  }

  summary.overlayRule =
    'SearchNoteTemplateSectionOverlay: Standard iff user_id === null; else Custom (API NOTE_TEMPLATES_API.md)';
  return summary;
}

export function logNoteTemplateSectionsClassification(label, rows) {
  const s = summarizeNoteTemplateSectionsForUi(rows);
  console.info(`[note-template-sections UI classification] ${label}`, s);
  return s;
}
