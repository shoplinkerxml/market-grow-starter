import { useEffect, useState, RefObject } from "react";

export function useVirtualRows(enabled: boolean, rowsLength: number, tableElRef: RefObject<HTMLTableElement | null>, rowHeight: number = 44) {
  const [virtualStart, setVirtualStart] = useState(0);
  const [virtualEnd, setVirtualEnd] = useState(rowsLength);
  const [topH, setTopH] = useState(0);
  const [bottomH, setBottomH] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const tableEl = tableElRef.current;
    const scroller = tableEl?.parentElement || null;
    if (!scroller) return;
    const handler = () => {
      const h = scroller.clientHeight || 0;
      const top = scroller.scrollTop || 0;
      const start = Math.max(0, Math.floor(top / rowHeight) - 2);
      const visible = Math.max(1, Math.ceil(h / rowHeight) + 4);
      const end = Math.min(rowsLength, start + visible);
      setVirtualStart(start);
      setVirtualEnd(end);
      setTopH(start * rowHeight);
      setBottomH(Math.max(0, (rowsLength - end) * rowHeight));
    };
    handler();
    scroller.addEventListener("scroll", handler);
    window.addEventListener("resize", handler);
    return () => {
      scroller.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [enabled, rowsLength, tableElRef, rowHeight]);

  return { virtualStart, virtualEnd, topH, bottomH };
}

