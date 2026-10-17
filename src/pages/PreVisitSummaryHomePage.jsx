import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Auth from "@/components/Auth.jsx";
import IconVisitPrep from "@/components/IconVisitPrep.jsx";
import PageHeaderCountBadge from "@/components/PageHeaderCountBadge.jsx";
import VisitPrepHomeRecentList from "@/components/visitPrep/VisitPrepHomeRecentList.jsx";
import PreVisitSummaryExplainer from "@/components/visitPrep/PreVisitSummaryExplainer.jsx";
import { visitPrepMainColumnClass } from "@/components/visitPrep/VisitPrepPageShell.jsx";
import { useVisitPrepSidebar } from "@/hooks/useVisitPrepSidebar.js";
import * as api from "@/lib/api";
import { buildActiveRecordingNavState } from "@/utils/visitPrepRecordingHandoff.js";
import { visitPrepIsLinkedToEncounter } from "@/utils/visitPrepsListResponse.js";


const VISIT_PREP_HOME_PRIMARY_BUTTON_CLASS =
  "inline-flex shrink-0 items-center rounded-lg bg-[#183278] py-2.5 text-sm font-semibold text-white transition hover:bg-[#142a66]";

function PreVisitSummaryHomeContent() {
  const navigate = useNavigate();
  const {
    visitPrepList,
    sidebarRows,
    listLoading,
    listLoadingMore,
    listError,
    listTotal,
    visitPrepApiOffset,
    refreshVisitPrepList,
    loadMoreVisitPreps,
    deleteVisitPrepRow,
  } = useVisitPrepSidebar();
  const [deletingVisitPrepId, setDeletingVisitPrepId] = useState(
    /** @type {string | null} */ (null),
  );

  useEffect(() => {
    if (!api.getJWT()) {
      navigate("/login");
    }
  }, [navigate]);

  const homeRows = useMemo(() => {
    const textByVisitPrepId = new Map(
      visitPrepList
        .map((row) => {
          const visitPrepId = typeof row.id === "string" ? row.id : null;
          const text = typeof row.text === "string" ? row.text : "";
          return visitPrepId ? [visitPrepId, { text, row }] : null;
        })
        .filter(Boolean),
    );
    return sidebarRows.map((row) => {
      const entry = textByVisitPrepId.get(row.visitPrepId);
      const listRow = entry?.row;
      return {
        ...row,
        text: entry?.text ?? "",
        alreadyUsedForVisit: listRow ? visitPrepIsLinkedToEncounter(listRow) : false,
      };
    });
  }, [sidebarRows, visitPrepList]);

  const startNewPrep = useCallback(() => {
    navigate("/new-pre-visit-summary");
  }, [navigate]);

  const openPrep = useCallback(
    (chatId) => {
      navigate(`/pre-visit-summary/nova-chat?chat=${encodeURIComponent(chatId)}`);
    },
    [navigate],
  );

  const attachToPatientVisit = useCallback(
    (row) => {
      if (!row.visitPrepId || row.alreadyUsedForVisit) return;
      navigate("/active-recording", {
        state: buildActiveRecordingNavState({
          id: row.visitPrepId,
          title: row.title,
        }),
      });
    },
    [navigate],
  );

  const handleDeleteVisitPrep = useCallback(
    async (row) => {
      if (!row?.visitPrepId || deletingVisitPrepId) return;
      const name = row.title || "this pre-visit summary";
      const ok = window.confirm(
        `Delete "${name}"? This also deletes the linked Nova chat and cannot be undone.`,
      );
      if (!ok) return;

      setDeletingVisitPrepId(row.visitPrepId);
      try {
        const res = await deleteVisitPrepRow(row);
        if (!res.ok) {
          window.alert(res.message || "Could not delete pre-visit summary.");
        }
      } catch (err) {
        console.error("Error deleting pre-visit summary:", err);
        window.alert("Could not delete pre-visit summary.");
      } finally {
        setDeletingVisitPrepId(null);
      }
    },
    [deleteVisitPrepRow, deletingVisitPrepId],
  );

  return (
    <div className="min-h-[var(--mobile-viewport-height)] bg-gray-50 lg:min-h-[100dvh]">
      <div
        className={`${visitPrepMainColumnClass} mx-auto max-w-3xl py-8 sm:py-10`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-gray-900 sm:text-3xl">
              <IconVisitPrep className="h-8 w-8 sm:h-9 sm:w-9" />
              <span>Pre-Visit Summary</span>
              {!listLoading ? <PageHeaderCountBadge count={listTotal} /> : null}
            </h1>
          </div>
          <button
            type="button"
            onClick={startNewPrep}
            className={`${VISIT_PREP_HOME_PRIMARY_BUTTON_CLASS} px-4`}
          >
            + New Pre-Visit Summary
          </button>
        </div>

        <PreVisitSummaryExplainer />

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">
              Recent pre-visit summaries
            </h2>
            {listError ? (
              <button
                type="button"
                onClick={() => void refreshVisitPrepList()}
                className="text-xs font-semibold text-[#183278] underline"
              >
                Retry
              </button>
            ) : null}
          </div>
          {listError ? (
            <p className="mb-3 text-sm text-red-600" role="alert">
              {listError}
            </p>
          ) : null}
          <VisitPrepHomeRecentList
            rows={homeRows}
            listLoading={listLoading}
            listTotal={listTotal}
            visitPrepApiOffset={visitPrepApiOffset}
            listLoadingMore={listLoadingMore}
            deletingVisitPrepId={deletingVisitPrepId}
            onSelect={(chatId) => openPrep(chatId)}
            onAttachToVisit={attachToPatientVisit}
            onDelete={handleDeleteVisitPrep}
            onLoadMore={loadMoreVisitPreps}
            onNewPrep={startNewPrep}
          />
        </div>
      </div>
    </div>
  );
}

export default function PreVisitSummaryHomePage() {
  return (
    <>
      <Auth />
      <PreVisitSummaryHomeContent />
    </>
  );
}
