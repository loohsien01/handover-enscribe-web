import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountSectionPanel from "@/components/account/AccountSectionPanel.jsx";
import ProfessionCombobox from "@/components/ProfessionCombobox.jsx";
import * as api from "@/lib/api";
import {
  specialtyFromFormValues,
  specialtyToFormValues,
} from "@/utils/accountProfile.js";
import { STORAGE_KEYS } from "@/utils/storageConfig";

export default function AccountProfilePage({
  profile,
  profileLoading,
  profileError,
  onProfileSaved,
  isActive = true,
}) {
  const navigate = useNavigate();
  const [userEmail] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.auth.userEmail) || "";
    } catch {
      return "";
    }
  });

  const [username, setUsername] = useState("");
  const [professionValue, setProfessionValue] = useState("");
  const [professionOther, setProfessionOther] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [syncedProfileKey, setSyncedProfileKey] = useState(null);

  const applyProfile = useCallback((nextProfile) => {
    setUsername(nextProfile.username || "");
    const form = specialtyToFormValues(nextProfile.specialty);
    setProfessionValue(form.professionValue);
    setProfessionOther(form.professionOther);
    setProfileDirty(false);
  }, []);

  const profileKey = profile
    ? `${profile.id ?? ""}:${profile.updated_at ?? ""}:${profile.username ?? ""}:${profile.specialty ?? ""}`
    : "";

  if (profile && profileKey !== syncedProfileKey) {
    setSyncedProfileKey(profileKey);
    applyProfile(profile);
  }

  useEffect(() => {
    if (isActive) return;
    setProfileSaveSuccess(false);
    setProfileSaveError(null);
    if (profile) applyProfile(profile);
  }, [isActive, profile, applyProfile]);

  const onSaveProfile = async (e) => {
    e.preventDefault();
    if (profileSaving) return;

    const trimmedUsername = username.trim();
    const specialty = specialtyFromFormValues(professionValue, professionOther);

    if (!trimmedUsername) {
      setProfileSaveError("Username is required.");
      setProfileSaveSuccess(false);
      return;
    }
    if (!specialty) {
      setProfileSaveError("Medical profession is required.");
      setProfileSaveSuccess(false);
      return;
    }

    setProfileSaveError(null);
    setProfileSaveSuccess(false);
    setProfileSaving(true);

    const result = await api.patchUserProfile({
      username: trimmedUsername,
      specialty,
    });
    setProfileSaving(false);

    if (!result.success) {
      if (result.status === 401) {
        navigate("/login");
        return;
      }
      setProfileSaveError(result.error || "Could not save profile.");
      return;
    }

    onProfileSaved(result.profile);
    setProfileSaveSuccess(true);
  };

  return (
    <AccountSectionPanel
      title="Profile"
      description="Your public username and medical profession."
    >
      {profileLoading && (
        <p className="text-sm text-gray-600" role="status">
          Loading profile…
        </p>
      )}

      {!profileLoading && profileError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {profileError}
        </div>
      )}

      {!profileLoading && !profileError && (
        <form onSubmit={(e) => void onSaveProfile(e)} className="space-y-5">
          <div>
            <label
              htmlFor="account-email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="account-email"
              type="email"
              value={userEmail}
              readOnly
              disabled
              className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Email is managed through your sign-in provider and cannot be changed
              here.
            </p>
          </div>

          <div>
            <label
              htmlFor="account-username"
              className="block text-sm font-medium text-gray-700"
            >
              Username
            </label>
            <input
              id="account-username"
              type="text"
              required
              minLength={1}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setProfileDirty(true);
                setProfileSaveSuccess(false);
              }}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#7C9DF9] focus:outline-none focus:ring-2 focus:ring-[#7C9DF9]/30"
              autoComplete="username"
            />
          </div>

          <ProfessionCombobox
            id="account-profession"
            key={syncedProfileKey || "account-profession"}
            professionValue={professionValue}
            professionOther={professionOther}
            onProfessionValueChange={(value) => {
              setProfessionValue(value);
              setProfileDirty(true);
              setProfileSaveSuccess(false);
            }}
            onProfessionOtherChange={(value) => {
              setProfessionOther(value);
              setProfileDirty(true);
              setProfileSaveSuccess(false);
            }}
            labelClassName="block text-sm font-medium text-gray-700"
          />

          {(profileSaveError || profileSaveSuccess) && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                profileSaveError
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
              role={profileSaveError ? "alert" : "status"}
            >
              {profileSaveError || "Profile saved."}
            </div>
          )}

          <button
            type="submit"
            disabled={profileSaving || !profileDirty}
            className="rounded-xl bg-[#183278] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#142a5e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {profileSaving ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
    </AccountSectionPanel>
  );
}
