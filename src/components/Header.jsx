import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import { useSidebar } from "@/context/SidebarContext";
import { useEntitlements } from "@/context/EntitlementsContext.jsx";
// import {
//   formatListCountForBadge,
//   LIST_COUNT_BADGE_CAP,
// } from "@/utils/listCountBadge.js";
import { STORAGE_KEYS } from "@/utils/storageConfig";
import {
  MAIN_NAV_EXPANDED_WIDTH_PX,
  MAIN_NAV_MOBILE_DRAWER_MIN_WIDTH_PX,
} from "@/constants/shellLayout.js";
import IconMic from "@/components/IconMic.jsx";
import customizeSvg from "/icons/customize.svg?raw";
// import patientEncounterSvg from "/icons/patient-encounter.svg?raw";

const SIDEBAR_BG = "bg-[#183278]";

// function IconEncounters(props) {
//   return (
//     <span
//       className={`inline-flex shrink-0 [&>svg]:h-full [&>svg]:w-full [&>svg]:block ${props.className || ""}`}
//       aria-hidden
//       dangerouslySetInnerHTML={{ __html: patientEncounterSvg }}
//     />
//   );
// }

function IconCustomize(props) {
  return (
    <span
      className={`inline-flex shrink-0 [&>svg]:h-full [&>svg]:w-full [&>svg]:block [&_path]:fill-current ${props.className || ""}`}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: customizeSvg }}
    />
  );
}

function IconNova(props) {
  return (
    <svg
      className={props.className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z"
      />
    </svg>
  );
}

function IconVisitPrepNav(props) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current [mask-image:url('/icons/visit%20prep.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url('/icons/visit%20prep.svg')] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] ${props.className || "w-5 h-5"}`}
    />
  );
}

function IconNotes(props) {
  return (
    <svg
      className={props.className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function IconRecordings(props) {
  return (
    <svg
      className={props.className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}

function IconChevron(props) {
  return (
    <svg
      className={props.className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function IconSignOut(props) {
  return (
    <svg
      className={props.className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function IconPlans(props) {
  return (
    <svg
      className={props.className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconSettings(props) {
  return (
    <svg
      className={props.className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function initialsFromEmail(email) {
  if (!email || typeof email !== "string") return "?";
  const local = (email.split("@")[0] || email).trim();
  const pair = local.slice(0, 2).toUpperCase();
  if (pair.length >= 2) return pair;
  if (pair.length === 1) return `${pair}?`;
  return "?";
}

function avatarHueFromEmail(email) {
  let h = 0;
  const s = email || "";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function navButtonClass(active, compact) {
  const layout = compact ? "justify-center px-2 gap-0" : "min-w-0 px-3 gap-3";
  const base = `flex h-10 w-full min-w-0 shrink-0 items-center text-left text-sm rounded-lg transition-colors ${layout}`;
  if (active) {
    return `${base} bg-white/20 text-white font-medium`;
  }
  return `${base} text-white/90 hover:bg-white/10 hover:text-white`;
}

function splitNavRowClass(active) {
  const base =
    "group flex h-10 w-full min-w-0 shrink-0 items-stretch rounded-lg transition-colors";
  if (active) return `${base} bg-white/20 text-white`;
  return `${base} text-white/90 hover:bg-white/10 hover:text-white`;
}

function splitNavMainClass(compact) {
  const layout = compact ? "justify-center px-2 gap-0" : "min-w-0 px-3 gap-3";
  return `flex h-full flex-1 min-w-0 items-center text-left text-sm ${layout} rounded-lg bg-transparent`;
}

const splitNavCaretClass =
  "h-10 w-10 shrink-0 rounded-lg bg-transparent text-white/90 group-hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

function iconClass(active) {
  return active ? "flex-shrink-0 text-white" : "flex-shrink-0 text-white/70";
}

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarExpanded, setSidebarExpanded } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Which sidebar group shows an indented submenu (expanded rail only). */
  const [sidebarSectionOpen, setSidebarSectionOpen] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.auth.userEmail) || "";
    } catch {
      return "";
    }
  });
  const accountMenuRef = useRef(null);
  const desktopAsideRef = useRef(null);
  // const [encounterCount, setEncounterCount] = useState(null);
  const { planTier, isBeta } = useEntitlements();

  const shellMinimalRoutes = [
    "/login",
    "/beta-login",
    "/signup",
    "/confirm-email",
    "/forgot-password",
    "/reset-password",
  ];
  const isAuthPage = shellMinimalRoutes.some((route) =>
    location.pathname.startsWith(route),
  );

  // useEffect(() => {
  //   if (isAuthPage) return;
  //   let cancelled = false;
  //   (async () => {
  //     const result = await api.getAllPatientEncounters({
  //       decryptName: false,
  //       limit: LIST_COUNT_BADGE_CAP,
  //     });
  //     if (cancelled) return;
  //     if (result.success && result.data) {
  //       setEncounterCount(Object.keys(result.data).length);
  //     }
  //   })();
  //   return () => {
  //     cancelled = true;
  //   };
  // }, [isAuthPage, location.pathname]);

  useEffect(() => {
    try {
      setUserEmail(localStorage.getItem(STORAGE_KEYS.auth.userEmail) || "");
    } catch {
      setUserEmail("");
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onDocMouseDown = (e) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

  /** Keep the rail expanded while the account flyout is open; collapse on close if not hovered. */
  useEffect(() => {
    if (accountMenuOpen) {
      setSidebarExpanded(true);
      return;
    }
    const aside = desktopAsideRef.current;
    if (aside && !aside.matches(":hover")) {
      setSidebarExpanded(false);
    }
  }, [accountMenuOpen, setSidebarExpanded]);

  const signOutAndRedirect = async () => {
    setSidebarSectionOpen(null);
    setAccountMenuOpen(false);
    setMobileOpen(false);
    try {
      await api.handleSignOut();
    } catch (e) {
      console.warn("signOut error", e);
    } finally {
      if (!isAuthPage) {
        navigate("/login");
      }
    }
  };

  const go = (path) => {
    setSidebarSectionOpen(null);
    setAccountMenuOpen(false);
    setMobileOpen(false);
    navigate(path);
  };

  const toggleSidebarSection = (key) => {
    setSidebarSectionOpen((prev) => (prev === key ? null : key));
  };

  const path = location.pathname;

  // const isEncountersSectionActive =
  //   path === "/view-patient-encounters" ||
  //   path.startsWith("/generate-note") ||
  //   path.startsWith("/edit-patient-encounter/");

  const isActive = (match) => {
    if (typeof match === "string") {
      if (match === "/view-templates") {
        return (
          path === match ||
          path.startsWith("/create-template") ||
          path.startsWith("/edit-template/")
        );
      }
      if (match === "/view-notes") {
        return path === match || path.startsWith("/edit-note/");
      }
      return path === match || path.startsWith(`${match}/`);
    }
    return match(path);
  };

  if (isAuthPage) {
    return null;
  }

  const isNewEncounterRoute =
    path === "/active-recording" ||
    path === "/generate-note" ||
    path === "/upload-recording" ||
    path.startsWith("/edit-patient-encounter/");

  const isRecordingsSectionActive =
    isActive("/view-recordings") || isActive("/upload-recording");

  const isCustomizeSectionActive =
    isActive("/dot-phrases") || isActive("/view-templates");

  const isVisitPrepActive =
    isActive("/pre-visit-summary") || path === "/new-pre-visit-summary";

  const NavContent = ({
    onNavigate = go,
    onCloseMobile = null,
    compact = false,
  }) => (
    <>
      <div
        className={`flex shrink-0 items-center border-b border-white/15 py-4 ${
          compact ? "justify-center px-2" : "justify-between gap-3 px-4"
        }`}
      >
        <button
          type="button"
          className={`flex min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
            compact ? "items-center justify-center" : "items-center gap-3"
          }`}
          onClick={() => onNavigate("/view-notes")}
        >
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0">
            E
          </div>
          <h1
            className={`text-xl font-semibold text-white tracking-tight truncate ${compact ? "sr-only" : ""}`}
          >
            EnScribe
          </h1>
        </button>
        {onCloseMobile && (
          <button
            type="button"
            className="p-2 rounded-lg text-white hover:bg-white/10 lg:hidden shrink-0"
            aria-label="Close menu"
            onClick={onCloseMobile}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
      <div className={`shrink-0 pt-3 pb-2 ${compact ? "px-2" : "px-3"}`}>
        <Link
          to="/active-recording"
          aria-label="New Recording"
          title="New Recording"
          onClick={(e) => {
            if (e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            onCloseMobile?.();
          }}
          className={`no-underline flex items-center justify-center whitespace-nowrap font-medium text-[#183278] shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#183278] focus-visible:ring-white/80 active:scale-[0.98] rounded-xl border-2 border-white/40 bg-white hover:bg-[#E8EEFB] h-12 min-h-[3rem] ${
            compact
              ? "mx-auto w-12 min-w-[3rem] shrink-0 p-0"
              : "w-full min-w-0 gap-4 px-3"
          } ${isNewEncounterRoute ? "ring-2 ring-[#7C9DF9] ring-offset-2 ring-offset-[#183278]" : ""}`}
        >
          <IconMic className="shrink-0 h-5 w-5" />
          {!compact && (
            <span className="text-base leading-7 tracking-tight">New Recording</span>
          )}
        </Link>
      </div>
      <nav
        className={`flex-1 min-w-0 py-2 space-y-1 overflow-y-auto overflow-x-hidden ${compact ? "px-2" : "px-3"}`}
      >
        {/* Encounters nav (commented out)
        <div>
          <div className={splitNavRowClass(isEncountersSectionActive)}>
            <button
              type="button"
              className={splitNavMainClass(compact)}
              onClick={() => onNavigate("/generate-note")}
              aria-label="Encounters"
            >
              <span
                className={`relative inline-flex ${iconClass(isEncountersSectionActive)}`}
              >
                <IconEncounters className="w-5 h-5" />
                {compact && encounterCount != null && encounterCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 translate-x-1.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[9px] font-bold leading-none bg-white text-[#183278] rounded-full">
                    {formatListCountForBadge(encounterCount)}
                  </span>
                )}
              </span>
              <span
                className={
                  compact ? "sr-only" : "flex-1 min-w-0 truncate text-left"
                }
              >
                Encounters
              </span>
              {!compact && encounterCount != null && encounterCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 flex shrink-0 items-center justify-center text-xs font-bold bg-white text-[#183278] rounded-full">
                  {formatListCountForBadge(encounterCount)}
                </span>
              )}
            </button>
            {!compact && (
              <button
                type="button"
                className={splitNavCaretClass}
                aria-label={
                  sidebarSectionOpen === "encounters"
                    ? "Collapse Encounters menu"
                    : "Expand Encounters menu"
                }
                aria-expanded={sidebarSectionOpen === "encounters"}
                onClick={() => toggleSidebarSection("encounters")}
              >
                <IconChevron
                  className={`mx-auto w-4 h-4 transition-transform duration-200 ${
                    sidebarSectionOpen === "encounters" ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          </div>
          {sidebarSectionOpen === "encounters" && !compact && (
            <div className="mt-1 pl-2 space-y-0.5 border-l border-white/20 ml-4">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-lg text-white/85 hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate("/generate-note")}
              >
                New Recording
              </button>
            </div>
          )}
        </div>
        */}

        <div>
          <div className={splitNavRowClass(isActive("/view-notes"))}>
            <button
              type="button"
              className={splitNavMainClass(compact)}
              onClick={() => onNavigate("/view-notes")}
              aria-label="Notes"
            >
              <span className={iconClass(isActive("/view-notes"))}>
                <IconNotes className="w-5 h-5" />
              </span>
              <span
                className={
                  compact ? "sr-only" : "flex-1 min-w-0 truncate text-left"
                }
              >
                Notes
              </span>
            </button>
            {!compact && (
              <button
                type="button"
                className={splitNavCaretClass}
                aria-label={
                  sidebarSectionOpen === "notes"
                    ? "Collapse Notes menu"
                    : "Expand Notes menu"
                }
                aria-expanded={sidebarSectionOpen === "notes"}
                onClick={() => toggleSidebarSection("notes")}
              >
                <IconChevron
                  className={`mx-auto w-4 h-4 transition-transform duration-200 ${
                    sidebarSectionOpen === "notes" ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          </div>
          {sidebarSectionOpen === "notes" && !compact && (
            <div className="mt-1 pl-2 space-y-0.5 border-l border-white/20 ml-4">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-lg text-white/85 hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate("/view-notes")}
              >
                View notes
              </button>
            </div>
          )}
        </div>

        {!onCloseMobile && (
        <div>
          <div className={splitNavRowClass(isRecordingsSectionActive)}>
            <button
              type="button"
              className={splitNavMainClass(compact)}
              onClick={() => {
                if (compact) {
                  setSidebarExpanded(true);
                }
                toggleSidebarSection("recordings");
              }}
              aria-label="Recordings"
            >
              <span className={iconClass(isRecordingsSectionActive)}>
                <IconRecordings className="w-5 h-5" />
              </span>
              <span
                className={
                  compact ? "sr-only" : "flex-1 min-w-0 truncate text-left"
                }
              >
                Recordings
              </span>
            </button>
            {!compact && (
              <button
                type="button"
                className={splitNavCaretClass}
                aria-label={
                  sidebarSectionOpen === "recordings"
                    ? "Collapse Recordings menu"
                    : "Expand Recordings menu"
                }
                aria-expanded={sidebarSectionOpen === "recordings"}
                onClick={() => toggleSidebarSection("recordings")}
              >
                <IconChevron
                  className={`mx-auto w-4 h-4 transition-transform duration-200 ${
                    sidebarSectionOpen === "recordings" ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          </div>
          {sidebarSectionOpen === "recordings" && !compact && (
            <div className="mt-1 pl-2 space-y-0.5 border-l border-white/20 ml-4">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-lg text-white/85 hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate("/view-recordings")}
              >
                View recordings
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-lg text-white/85 hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate("/upload-recording")}
              >
                Upload recording
              </button>
            </div>
          )}
        </div>
        )}

        <div>
          <div className={splitNavRowClass(isCustomizeSectionActive)}>
            <button
              type="button"
              className={splitNavMainClass(compact)}
              onClick={() => {
                if (compact) {
                  setSidebarExpanded(true);
                }
                toggleSidebarSection("customize");
              }}
              aria-label="Customize"
            >
              <span className={iconClass(isCustomizeSectionActive)}>
                <IconCustomize className="w-5 h-5" />
              </span>
              <span
                className={
                  compact ? "sr-only" : "flex-1 min-w-0 truncate text-left"
                }
              >
                Customize
              </span>
            </button>
            {!compact && (
              <button
                type="button"
                className={splitNavCaretClass}
                aria-label={
                  sidebarSectionOpen === "customize"
                    ? "Collapse Customize menu"
                    : "Expand Customize menu"
                }
                aria-expanded={sidebarSectionOpen === "customize"}
                onClick={() => toggleSidebarSection("customize")}
              >
                <IconChevron
                  className={`mx-auto w-4 h-4 transition-transform duration-200 ${
                    sidebarSectionOpen === "customize" ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          </div>
          {sidebarSectionOpen === "customize" && !compact && (
            <div className="mt-1 pl-2 space-y-0.5 border-l border-white/20 ml-4">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-lg text-white/85 hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate("/dot-phrases")}
              >
                Dot Phrases
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-lg text-white/85 hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate("/view-templates")}
              >
                Templates
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={navButtonClass(isActive("/nova-chat"), compact)}
          onClick={() => onNavigate("/nova-chat")}
          aria-label="Nova AI chat"
        >
          <span className={iconClass(isActive("/nova-chat"))}>
            <IconNova className="w-5 h-5" />
          </span>
          <span
            className={
              compact ? "sr-only" : "min-w-0 flex-1 truncate text-left"
            }
          >
            Nova
          </span>
        </button>

        <button
          type="button"
          className={navButtonClass(isVisitPrepActive, compact)}
          onClick={() => onNavigate("/pre-visit-summary")}
          aria-label="Pre-visit summary"
        >
          <span className={iconClass(isVisitPrepActive)}>
            <IconVisitPrepNav className="w-5 h-5" />
          </span>
          <span
            className={
              compact ? "sr-only" : "min-w-0 flex-1 truncate text-left"
            }
          >
            Pre-Visit Summary
          </span>
        </button>
      </nav>
      <div
        className={`shrink-0 w-full border-t border-white/15 py-2 ${
          compact ? "px-2" : "px-3"
        }`}
      >
        <div ref={accountMenuRef} className="relative z-20 w-full min-w-0">
          <button
            type="button"
            className={`flex w-full min-w-0 items-center rounded-xl py-2 text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
              compact ? "justify-center px-2" : "justify-start gap-3 px-3 text-left"
            } ${accountMenuOpen ? "bg-white/15" : ""}`}
            onClick={() => setAccountMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            aria-label="Account menu"
            title={
              compact && userEmail
                ? `${userEmail}${isBeta && planTier ? ` · ${planTier === "pro" ? "Pro" : "Free"}` : ""}`
                : undefined
            }
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-inner ring-1 ring-white/30"
              style={{
                backgroundColor: `hsl(${avatarHueFromEmail(userEmail)}, 46%, 42%)`,
              }}
              aria-hidden
            >
              {initialsFromEmail(userEmail)}
            </span>
            {!compact && (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-white/90">
                  {userEmail || "Account"}
                </span>
                {planTier && (
                  <span
                    className={`inline-flex min-w-12 shrink-0 items-center justify-center rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                      planTier === "pro"
                        ? "bg-amber-400/90 text-[#142a5e]"
                        : "bg-[#4B5D99] text-white"
                    }`}
                  >
                    {planTier === "pro" ? "Pro" : "Free"}
                  </span>
                )}
              </span>
            )}
          </button>
          {accountMenuOpen && (
            <div
              className={
                onCloseMobile
                  ? "absolute bottom-0 left-0 right-0 z-50 rounded-lg border border-white/15 bg-[#142a5e] py-1 shadow-lg ring-1 ring-black/20"
                  : "absolute bottom-0 left-full z-50 ml-2 min-w-[10rem] rounded-lg border border-white/15 bg-[#142a5e] py-1 shadow-lg ring-1 ring-black/20"
              }
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate("/account")}
              >
                <IconSettings className="h-5 w-5 shrink-0 text-white/80" />
                Settings
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate("/billing/plans")}
              >
                <IconPlans className="h-5 w-5 shrink-0 text-white/80" />
                Plans & Pricing
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10 hover:text-red-200"
                onClick={() => void signOutAndRedirect()}
              >
                <IconSignOut className="h-5 w-5 shrink-0 text-white/80" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <header
        className={`lg:hidden fixed top-0 inset-x-0 z-50 flex flex-col ${SIDEBAR_BG} border-b border-white/15`}
        style={{ paddingTop: "var(--safe-area-top)" }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <button
          type="button"
          className="p-2 -ml-2 rounded-lg text-white hover:bg-white/10"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <span className="text-lg font-semibold text-white tracking-tight">
          EnScribe
        </span>
        <div className="w-10" aria-hidden />
        </div>
      </header>

      <aside
        ref={desktopAsideRef}
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 ${SIDEBAR_BG} z-40 overflow-visible border-r border-white/10 transition-[width] duration-200 ease-out lg:w-[var(--shell-content-inset)]`}
        aria-label="Main navigation"
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => {
          if (!accountMenuOpen) setSidebarExpanded(false);
        }}
      >
        <NavContent compact={!sidebarExpanded} />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={`relative flex h-full max-w-full flex-col shadow-xl ${SIDEBAR_BG}`}
            style={{
              width: `min(${MAIN_NAV_EXPANDED_WIDTH_PX}px, 92vw)`,
              minWidth: `${MAIN_NAV_MOBILE_DRAWER_MIN_WIDTH_PX}px`,
              paddingTop: "var(--safe-area-top)",
              paddingBottom: "var(--safe-area-bottom)",
            }}
          >
            <NavContent
              onNavigate={go}
              onCloseMobile={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
};

export default Header;
