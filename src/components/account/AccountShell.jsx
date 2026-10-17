import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ACCOUNT_NAV, accountPath } from "@/constants/accountNav.js";
import useAccountSettingsData from "@/hooks/useAccountSettingsData.js";
import AccountBillingPage from "@/pages/account/AccountBillingPage.jsx";
import AccountLegalPage from "@/pages/account/AccountLegalPage.jsx";
import AccountProfilePage from "@/pages/account/AccountProfilePage.jsx";
import AccountSecurityPage from "@/pages/account/AccountSecurityPage.jsx";

function navLinkClass({ isActive }) {
  return [
    "block rounded-xl px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2",
    isActive
      ? "bg-[#183278] text-white shadow-sm"
      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
  ].join(" ");
}

function tabSlugFromPath(pathname) {
  const slug = pathname.split("/").filter(Boolean)[1];
  return ACCOUNT_NAV.some((item) => item.slug === slug) ? slug : "profile";
}

function TabPanel({ slug, activeSlug, children }) {
  const active = slug === activeSlug;
  return (
    <div hidden={!active} aria-hidden={!active}>
      {children}
    </div>
  );
}

export default function AccountShell() {
  const { pathname } = useLocation();
  const activeSlug = tabSlugFromPath(pathname);
  const {
    profile,
    setProfile,
    profileLoading,
    profileError,
    baaStatus,
    baaLoading,
    baaError,
  } = useAccountSettingsData();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start lg:gap-10">
      <aside className="shrink-0 lg:w-56 xl:w-60">
        <header className="mb-4 px-3 lg:mb-6">
          <p className="text-sm font-medium uppercase tracking-wide text-[#183278]/70">
            Account
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Settings
          </h1>
        </header>

        <nav
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
          aria-label="Account settings"
        >
          {ACCOUNT_NAV.map((item) =>
            item.disabled ? (
              <button
                key={item.slug}
                type="button"
                disabled
                className="min-w-[9.5rem] shrink-0 cursor-not-allowed rounded-xl px-3 py-2.5 text-left text-gray-400 lg:min-w-0 lg:w-full"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {item.label}
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 ring-1 ring-gray-200">
                    WIP
                  </span>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-gray-400">
                  {item.description}
                </span>
              </button>
            ) : (
              <NavLink
                key={item.slug}
                to={accountPath(item.slug)}
                className={({ isActive }) =>
                  [
                    navLinkClass({ isActive }),
                    "min-w-[9.5rem] shrink-0 lg:min-w-0 lg:w-full",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="block text-sm font-semibold">
                      {item.label}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs leading-snug ${
                        isActive ? "text-white/80" : "text-gray-500"
                      }`}
                    >
                      {item.description}
                    </span>
                  </>
                )}
              </NavLink>
            ),
          )}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <TabPanel slug="profile" activeSlug={activeSlug}>
          <AccountProfilePage
            profile={profile}
            profileLoading={profileLoading}
            profileError={profileError}
            onProfileSaved={setProfile}
            isActive={activeSlug === "profile"}
          />
        </TabPanel>
        <TabPanel slug="billing" activeSlug={activeSlug}>
          <AccountBillingPage />
        </TabPanel>
        <TabPanel slug="legal" activeSlug={activeSlug}>
          <AccountLegalPage
            baaStatus={baaStatus}
            baaLoading={baaLoading}
            baaError={baaError}
          />
        </TabPanel>
        <TabPanel slug="security" activeSlug={activeSlug}>
          <AccountSecurityPage />
        </TabPanel>
      </main>
    </div>
  );
}
