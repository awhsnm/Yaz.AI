import { useMemo } from "react";

export interface Annotation {
  id: string;
  start_index: number;
  end_index: number;
  color_code: string;
  comment_text: string;
}

interface Props {
  content: string;
  annotations: Annotation[];
  activeId?: string | null;
  onMarkClick?: (id: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Renders plain text with annotation ranges wrapped in <mark>.
 * Overlapping ranges: we sort and skip ranges that overlap an already-painted region.
 */
const AnnotatedText = ({ content, annotations, activeId, onMarkClick, containerRef }: Props) => {
  const parts = useMemo(() => {
    const sorted = [...annotations]
      .filter((a) => a.start_index < a.end_index && a.start_index >= 0 && a.end_index <= content.length)
      .sort((a, b) => a.start_index - b.start_index);
    const segs: Array<{ key: string; text: string; ann?: Annotation }> = [];
    let cursor = 0;
    for (const a of sorted) {
      if (a.start_index < cursor) continue; // skip overlap
      if (a.start_index > cursor) {
        segs.push({ key: `t-${cursor}`, text: content.slice(cursor, a.start_index) });
      }
      segs.push({ key: `a-${a.id}`, text: content.slice(a.start_index, a.end_index), ann: a });
      cursor = a.end_index;
    }
    if (cursor < content.length) segs.push({ key: `t-${cursor}-end`, text: content.slice(cursor) });
    return segs;
  }, [content, annotations]);

  return (
    <div
      ref={containerRef}
      data-essay-content
      className="whitespace-pre-wrap font-display text-sm leading-relaxed select-text"
    >
      {parts.map((p) =>
        p.ann ? (
          <mark
            key={p.key}
            data-annotation-id={p.ann.id}
            onClick={() => onMarkClick?.(p.ann!.id)}
            style={{ backgroundColor: p.ann.color_code }}
            className={`rounded px-0.5 cursor-pointer transition-shadow ${activeId === p.ann.id ? "ring-2 ring-primary ring-offset-1" : ""}`}
          >
            {p.text}
          </mark>
        ) : (
          <span key={p.key}>{p.text}</span>
        )
      )}
      {parts.length === 0 && <span className="text-muted-foreground italic">Empty</span>}
    </div>
  );
};

export default AnnotatedText;