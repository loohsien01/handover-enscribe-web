/**
 * Shell horizontal layout (desktop `lg:`).
 *
 * Mobile safe areas + three outlet wrappers (`.mobile-app-shell`, `.mobile-minimal-shell`,
 * `.mobile-full-shell`) are defined in src/styles/globals.css and wired in App.jsx.
 * `--mobile-header-bar` (3.5rem) must stay in sync with Header mobile `h-14`.
 *
 * `--shell-content-inset` (set in App.jsx `ShellContentInsetVars`) drives: (1) main content
 * `padding-left` on desktop via `.mobile-app-shell` / `.mobile-full-shell` in globals.css,
 * (2) expanded nav width in Header (`lg:w-[var(--shell-content-inset)]`).
 * It must track nav state: collapsed strip vs expanded full nav.
 *
 * Re-enabling RecentNotesRail (see App.jsx checklist):
 * - Add NOTES_RAIL_WIDTH_PX to the inset for both collapsed and expanded branches in
 *   ShellContentInsetVars (rail sits beside the nav; body must clear nav + rail).
 * - Uncomment RecentNotesRail, `--notes-rail-width`, and NOTES_RAIL_WIDTH_PX import there.
 * - No change to Header aside logic unless rail positioning changes.
 */
/** Collapsed main nav strip width (Header aside + main content inset when collapsed). */
export const MAIN_NAV_COLLAPSED_PX = 72

/** Full nav width when the sidebar is expanded (icons + labels). */
export const MAIN_NAV_EXPANDED_WIDTH_PX = 270

/**
 * Mobile overlay drawer (`Header` aside): `min()` max width tracks expanded nav;
 * minimum width uses the same proportion as the former 15.5rem / 16rem pair.
 */
export const MAIN_NAV_MOBILE_DRAWER_MIN_WIDTH_PX = Math.round(
  MAIN_NAV_EXPANDED_WIDTH_PX * (15.5 / 16)
)

/** Width of the fixed recent-notes column (`left-[var(--shell-nav-collapsed-width)]`, uses `--notes-rail-width` in RecentNotesRail). */
export const NOTES_RAIL_WIDTH_PX = 224 + 40
