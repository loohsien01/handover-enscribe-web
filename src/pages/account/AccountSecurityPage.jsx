import React from "react";
import AccountSectionPanel from "@/components/account/AccountSectionPanel.jsx";

export default function AccountSecurityPage() {
  return (
    <AccountSectionPanel
      title="Security"
      titleAddon={
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 ring-1 ring-gray-200">
          WIP
        </span>
      }
      description="Password and sign-in."
    >
      <p className="text-sm text-gray-600">
        Changing your password while signed in is not available yet.
      </p>
    </AccountSectionPanel>
  );
}
