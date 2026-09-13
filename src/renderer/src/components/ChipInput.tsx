import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { filterCandidates, mergeChipCandidates } from "@shared/chips";

export default function ChipInput({
  values,
  candidates,
  multi,
  onChange,
  onCreate,
}: {
  values: string[];
  candidates: string[];
  multi: boolean;
  onChange: (values: string[]) => void;
  onCreate?: (value: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const merged = useMemo(() => mergeChipCandidates(candidates, []), [candidates]);
  const shown = useMemo(() => {
    const list = filterCandidates(merged, query).filter((c) => !values.includes(c));
    return list.slice(0, 12);
  }, [merged, query, values]);

  const addValue = (value: string): void => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (multi) {
      if (!values.includes(trimmed)) onChange([...values, trimmed]);
    } else {
      onChange([trimmed]);
    }
    setQuery("");
  };

  const canCreate = query.trim() && !merged.includes(query.trim());

  return (
    <div className="chip-input">
      <div className="chip-input-selected">
        {values.map((value) => (
          <span key={value} className="chip active">
            {value}
            <button
              className="chip-remove"
              onClick={() => onChange(values.filter((v) => v !== value))}
              title="remove"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="chip-input-field"
          value={query}
          placeholder={multi ? "输入后回车添加" : "输入后回车选择"}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (query.trim()) {
                addValue(query);
                onCreate?.(query);
              }
            }
          }}
        />
      </div>

      {focused && shown.length > 0 && (
        <div className="chip-input-menu">
          {shown.map((candidate) => (
            <button
              key={candidate}
              className="chip-input-option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addValue(candidate)}
            >
              {candidate}
            </button>
          ))}
          {canCreate && (
            <button
              className="chip-input-option create"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                addValue(query);
                onCreate?.(query);
              }}
            >
              <Plus size={13} />
              新建：{query.trim()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
