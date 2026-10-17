import { useEffect, useState } from 'react';

/** Matches Tailwind `md:` — visit prep shell stacks below this width. */
export const VISIT_PREP_MOBILE_LAYOUT_MEDIA = '(max-width: 767px)';

export function isVisitPrepMobileLayout() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(VISIT_PREP_MOBILE_LAYOUT_MEDIA).matches;
}

/** Reactive visit prep mobile layout flag (below `md`). */
export function useVisitPrepMobileLayout() {
  const [isMobile, setIsMobile] = useState(() => isVisitPrepMobileLayout());

  useEffect(() => {
    const mq = window.matchMedia(VISIT_PREP_MOBILE_LAYOUT_MEDIA);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
