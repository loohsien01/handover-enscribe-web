import React, { useEffect } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import Header from '@/components/Header'
// RecentNotesRail: uncomment import + JSX below; import NOTES_RAIL_WIDTH_PX; add rail width in ShellContentInsetVars; set --notes-rail-width on ShellContentInsetVars root (see shellLayout.js).
// import RecentNotesRail from '@/components/RecentNotesRail'
import { SidebarProvider, useSidebar } from '@/context/SidebarContext'
import useRecordingFullViewport from '@/hooks/useRecordingFullViewport'
import { EntitlementsProvider } from '@/context/EntitlementsContext.jsx'
import {
  // NOTES_RAIL_WIDTH_PX,
  MAIN_NAV_COLLAPSED_PX,
  MAIN_NAV_EXPANDED_WIDTH_PX,
} from '@/constants/shellLayout.js'
import LoginPage from '@/pages/LoginPage'
import BetaLoginPage from '@/pages/BetaLoginPage'
import SignupPage from '@/pages/SignupPage'
import ConfirmEmailPage from '@/pages/ConfirmEmailPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import GenerateNotePage from '@/pages/GenerateNotePage'
import UploadRecordingPage from '@/pages/UploadRecordingPage'
import ViewPatientEncountersPage from '@/pages/ViewPatientEncountersPage'
import EditPatientEncounterPage from '@/pages/EditPatientEncounterPage'
import ViewRecordingsPage from '@/pages/ViewRecordingsPage'
import ViewSoapNotesPage from '@/pages/ViewSoapNotesPage'
import ViewNotesPage from '@/pages/ViewNotesPage'
import EditSoapNotePage from '@/pages/EditSoapNotePage'
import EditNotePage from '@/pages/EditNotePage'
import DotPhrasesPage from '@/pages/DotPhrasesPage'
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ComplianceAuditPage from '@/pages/ComplianceAuditPage'
import ViewTemplatesPage from '@/pages/ViewTemplatesPage'
import TemplateBuilderPage from '@/pages/TemplateBuilderPage'
import BillingPlansPage from '@/pages/BillingPlansPage'
import BillingSuccessPage from '@/pages/BillingSuccessPage'
import AccountPage from '@/pages/AccountPage'
import BaaPage from '@/pages/BaaPage'
import NovaChatPage from '@/pages/NovaChatPage'
import PreVisitSummaryHomePage from '@/pages/PreVisitSummaryHomePage'
import NewPreVisitSummaryPage from '@/pages/NewPreVisitSummaryPage'
import PreVisitSummaryNovaChatPage from '@/pages/PreVisitSummaryNovaChatPage'
import ActiveRecordingPage from '@/pages/ActiveRecordingPage'
import { syncExtensionSession } from '@/lib/api'

const AUTH_ROUTE_PREFIXES = ['/login', '/beta-login', '/signup', '/confirm-email', '/forgot-password', '/reset-password']
const NO_NAV_ROUTE_PREFIXES = ['/baa']
const SHELL_MINIMAL_ROUTE_PREFIXES = [...AUTH_ROUTE_PREFIXES, ...NO_NAV_ROUTE_PREFIXES]

function ShellContentInsetVars({ children }) {
  const { sidebarExpanded } = useSidebar()
  // With RecentNotesRail: insetPx = (expanded ? MAIN_NAV_EXPANDED_WIDTH_PX : MAIN_NAV_COLLAPSED_PX) + NOTES_RAIL_WIDTH_PX
  const insetPx = sidebarExpanded ? MAIN_NAV_EXPANDED_WIDTH_PX : MAIN_NAV_COLLAPSED_PX
  return (
    <div
      className="min-h-screen"
      style={{
        '--shell-content-inset': `${insetPx}px`,
        '--shell-nav-collapsed-width': `${MAIN_NAV_COLLAPSED_PX}px`,
        // '--notes-rail-width': `${NOTES_RAIL_WIDTH_PX}px`,
      }}
    >
      {children}
    </div>
  )
}

const ACTIVE_RECORDING_PATH = '/active-recording'

/**
 * App chrome: Header + one of three mobile layout shells around <Outlet />.
 * Shell class definitions and CSS variables live in src/styles/globals.css.
 *
 * Mobile shell pick (narrow viewport, short recording mockup, or desktop sidebar inset):
 *   1. mobile-minimal-shell — auth (SHELL_MINIMAL_ROUTE_PREFIXES), no app header
 *   2. mobile-full-shell     — /active-recording full-bleed (narrow or short); header hidden
 *   3. mobile-app-shell      — everything else (Notes, Nova, …) with mobile header
 *
 * When adding a route: default is mobile-app-shell unless it is auth-like or recording.
 */
function AppShell() {
  const location = useLocation()
  const shellMinimal = SHELL_MINIMAL_ROUTE_PREFIXES.some((r) => location.pathname.startsWith(r))
  const hideHeader = NO_NAV_ROUTE_PREFIXES.some((r) => location.pathname.startsWith(r))

  // Sync session to the Chrome extension on auth routes and /view-notes only.
  useEffect(() => {
    syncExtensionSession()
  }, [location.pathname])

  useEffect(() => {
    const onFocus = () => syncExtensionSession()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  const recordingFullViewport = useRecordingFullViewport()
  const onActiveRecordingRoute = location.pathname.startsWith(ACTIVE_RECORDING_PATH)
  const recordingShellMobile = onActiveRecordingRoute && recordingFullViewport

  return (
    <SidebarProvider>
      <EntitlementsProvider>
        <ShellContentInsetVars>
          {/* Header / sidebar hidden on /active-recording in full-bleed recording layout */}
          <div className={recordingShellMobile ? 'hidden' : hideHeader ? 'max-lg:hidden' : undefined}>
            {!hideHeader && <Header />}
          </div>
          {/* <RecentNotesRail /> */}
          {shellMinimal ? (
            /* Auth — globals.css .mobile-minimal-shell */
            <div className="mobile-minimal-shell">
              <Outlet />
            </div>
          ) : recordingShellMobile ? (
            /* Pocket recording — globals.css .mobile-full-shell */
            <div className="mobile-full-shell recording-full-bleed">
              <Outlet />
            </div>
          ) : (
            /* Default app pages — globals.css .mobile-app-shell */
            <div className="mobile-app-shell lg:min-h-screen">
              <Outlet />
            </div>
          )}
        </ShellContentInsetVars>
      </EntitlementsProvider>
    </SidebarProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <LoginPage /> },
      // Temporary, unlinked beta login (Turnstile dogfood). See docs/AUTH_BOT_PROTECTION.md.
      { path: '/beta-login', element: <BetaLoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/confirm-email', element: <ConfirmEmailPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      /*
       * Legacy /dashboard → /view-notes. Also re-routed in:
       * LoginPage, useRedirectIfAuthenticated, Header (logo), ActiveRecordingPage,
       * NovaChatPage, BillingPlansPage, BillingSuccessPage, NotFoundPage.
       */
      { path: '/nova-chat', element: <NovaChatPage /> },
      { path: '/pre-visit-summary', element: <PreVisitSummaryHomePage /> },
      { path: '/new-pre-visit-summary', element: <NewPreVisitSummaryPage /> },
      { path: '/pre-visit-summary/nova-chat', element: <PreVisitSummaryNovaChatPage /> },
      { path: '/generate-note', element: <GenerateNotePage /> },
      { path: '/upload-recording', element: <UploadRecordingPage /> },
      { path: '/active-recording', element: <ActiveRecordingPage /> },
      { path: '/view-patient-encounters', element: <ViewPatientEncountersPage /> },
      { path: '/edit-patient-encounter/:id', element: <EditPatientEncounterPage /> },
      { path: '/view-recordings', element: <ViewRecordingsPage /> },
      { path: '/view-templates', element: <ViewTemplatesPage /> },
      { path: '/create-template', element: <TemplateBuilderPage /> },
      { path: '/edit-template/:id', element: <TemplateBuilderPage /> },
      // { path: '/view-soap-notes', element: <ViewSoapNotesPage /> },
      { path: '/view-notes', element: <ViewNotesPage /> },
      // { path: '/edit-soap-note/:id', element: <EditSoapNotePage /> },
      { path: '/edit-note/:id', element: <EditNotePage /> },
      { path: '/dot-phrases', element: <DotPhrasesPage /> },
      { path: '/privacy-policy', element: <PrivacyPolicyPage /> },
      {
        path: '/account',
        element: <AccountPage />,
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: null },
          { path: 'billing', element: null },
          { path: 'legal', element: null },
          { path: 'security', element: null },
        ],
      },
      { path: '/billing/plans', element: <BillingPlansPage /> },
      { path: '/billing/success', element: <BillingSuccessPage /> },
      { path: '/baa', element: <BaaPage /> },
      { path: '/compliance-audit', element: <ComplianceAuditPage /> },
      { path: '/', element: <Navigate to="/login" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
