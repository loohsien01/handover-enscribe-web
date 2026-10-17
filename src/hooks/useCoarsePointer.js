import { useEffect, useState } from "react";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

/**
 * True when the primary input is touch-like (phones/tablets).
 * Desktop mouse flows typically return false.
 */
export default function useCoarsePointer() {
  const [isCoarse, setIsCoarse] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(COARSE_POINTER_QUERY).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(COARSE_POINTER_QUERY);
    const onChange = () => setIsCoarse(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isCoarse;
}
