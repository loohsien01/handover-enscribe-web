import { useEffect, useState } from "react";
import { isMobileDevice, MOBILE_VIEWPORT_MEDIA } from "@/utils/device";

/**
 * Reactive mobile layout flag (viewport &lt; lg or mobile user agent).
 */
export default function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => isMobileDevice());

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_VIEWPORT_MEDIA);
    const onChange = () => setIsMobile(isMobileDevice());
    onChange();
    mq.addEventListener("change", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return isMobile;
}
