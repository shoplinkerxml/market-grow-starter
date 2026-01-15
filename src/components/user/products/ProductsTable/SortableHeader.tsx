import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  id: string;
  children: React.ReactNode;
};

export function SortableHeader({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const adjustedTransform =
    transform
      ? {
          ...transform,
          x: Math.round(transform.x),
          y: Math.round(transform.y),
          scaleX: 1,
          scaleY: 1,
        }
      : null;
  const style = {
    transform: CSS.Transform.toString(adjustedTransform),
    transition,
    cursor: "grab",
    userSelect: "none",
    touchAction: "none",
    willChange: "transform",
    transformOrigin: "0 0",
    backfaceVisibility: "hidden",
    WebkitFontSmoothing: "antialiased",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`inline-flex items-center gap-1 ${isDragging ? "text-foreground" : ""}`}
    >
      {children}
    </div>
  );
}
