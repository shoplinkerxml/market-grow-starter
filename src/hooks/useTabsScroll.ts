import { useEffect, useRef, useState } from 'react';

export function useTabsScroll() {
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  useEffect(() => {
    const el = tabsScrollRef.current;
    const checkOverflow = () => {
      if (!el) return;
      setHasOverflow(el.scrollWidth > el.clientWidth + 2);
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, []);
  return { tabsScrollRef, hasOverflow };
}

