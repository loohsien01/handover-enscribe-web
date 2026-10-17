import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";

/**
 * Load Settings data once when the Settings page mounts.
 * Tab switches do not refetch; leaving and returning to Settings does.
 */
export default function useAccountSettingsData() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [baaStatus, setBaaStatus] = useState(null);
  const [baaLoading, setBaaLoading] = useState(true);
  const [baaError, setBaaError] = useState(null);

  useEffect(() => {
    if (!api.getJWT()) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      const [profileResult, baaResult] = await Promise.all([
        api.getUserProfile(),
        api.getBaaStatus(),
      ]);
      if (cancelled) return;

      if (profileResult.status === 401 || baaResult.status === 401) {
        navigate("/login");
        return;
      }

      setProfileLoading(false);
      setBaaLoading(false);

      if (profileResult.success) {
        setProfile(profileResult.profile);
        setProfileError(null);
      } else {
        setProfile(null);
        setProfileError(profileResult.error || "Could not load your profile.");
      }

      if (baaResult.success) {
        setBaaStatus(baaResult.status);
        setBaaError(null);
      } else {
        setBaaStatus(null);
        setBaaError(baaResult.error || "Could not load BAA status.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return {
    profile,
    setProfile,
    profileLoading,
    profileError,
    baaStatus,
    baaLoading,
    baaError,
  };
}
