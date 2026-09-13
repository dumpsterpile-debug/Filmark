import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Globe, Play, RotateCcw, Search, Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildFacets, type FacetKind } from "@/lib/search";
import { shortPath } from "@/lib/format";
import { useAppStore, useCriteria, useDraft } from "@/store/useAppStore";
import LanguageSwitch from "@/components/LanguageSwitch";
import { APP_DISPLAY_NAME } from "@shared/appIdentity";
import type { TranslationKey } from "@/i18n";

function FilterChip({
  label,
  count,
  active,
  onToggle,
}: {
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button className={active ? "chip active" : "chip"} onClick={onToggle}>
      <span className="chip-name">{label}</span>
      <span className="chip-count">{count}</span>
    </button>
  );
}

/** 四个 facet 的渲染顺序与标题：面板、草稿 chip、已应用 chip 共用同一张表 */
const FACETS = [
  { kind: "tags", labelKey: "search.labelTag" },
  { kind: "artists", labelKey: "search.labelArtist" },
  { kind: "characters", labelKey: "search.labelCharacter" },
  { kind: "genres", labelKey: "search.labelGenre" },
] as const satisfies readonly { kind: FacetKind; labelKey: TranslationKey }[];

export default function SearchBar(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videos = useAppStore((s) => s.videos);
  const metadataPath = useAppStore((s) => s.metadataPath);
  const metadataFileCount = useAppStore((s) => s.metadataFileCount);
  const loading = useAppStore((s) => s.loading);
  const criteria = useCriteria();
  const draft = useDraft();
  const advancedOpen = useAppStore((s) => s.advancedOpen);
  const setDraftQuery = useAppStore((s) => s.setDraftQuery);
  const toggleDraft = useAppStore((s) => s.toggleDraft);
  const clearDrafts = useAppStore((s) => s.clearDrafts);
  const setAdvancedOpen = useAppStore((s) => s.setAdvancedOpen);
  const applySearch = useAppStore((s) => s.applySearch);
  const removeApplied = useAppStore((s) => s.removeApplied);
  const chooseMetadata = useAppStore((s) => s.chooseMetadata);

  const facets = useMemo(() => buildFacets(videos), [videos]);
  const [draftOpen, setDraftOpen] = useState(false);
  const open = advancedOpen || draftOpen;

  const appliedFacetCount =
    criteria.tags.length +
    criteria.artists.length +
    criteria.characters.length +
    criteria.genres.length;
  const appliedCount = criteria.query.trim() || appliedFacetCount > 0 ? 1 + appliedFacetCount : 0;

  const draftChips: { id: string; label: string; title: string; onRemove: () => void }[] =
    FACETS.flatMap(({ kind, labelKey }) =>
      draft[kind].map((name) => ({
        id: `${kind}:${name}`,
        label: name,
        title: t(labelKey),
        onRemove: () => toggleDraft(kind, name),
      }))
    );

  const handleSearch = (): void => {
    setDraftOpen(false);
    applySearch();
  };

  return (
    <header className="search-bar">
      <div className="search-bar-row">
        <div className="brand">
          <span className="brand-icon">
            <Play size={18} fill="currentColor" />
          </span>
          <span className="brand-name">{APP_DISPLAY_NAME}</span>
        </div>

        <div className="search-form">
          <div className="search-input-wrap">
            <Search className="search-icon" size={18} />
            {draftChips.length > 0 && (
              <div className="search-prefix-chips" onMouseDown={(e) => e.preventDefault()}>
                {draftChips.map((chip) => (
                  <span
                    key={chip.id}
                    className="search-prefix-chip"
                    title={`${chip.title}: ${chip.label}`}
                  >
                    {chip.label}
                    <button
                      className="chip-remove"
                      onClick={chip.onRemove}
                      title={t("search.removeFilter")}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              data-testid="search-input"
              value={draft.query}
              placeholder={draftChips.length === 0 ? t("search.placeholder") : ""}
              onChange={(e) => setDraftQuery(e.target.value)}
              onFocus={() => setAdvancedOpen(true)}
              onBlur={() => {
                setTimeout(() => setDraftOpen(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
                if (e.key === "Escape") {
                  setAdvancedOpen(false);
                  setDraftOpen(false);
                }
              }}
            />
            {draft.query && (
              <button
                className="clear-search"
                onClick={() => setDraftQuery("")}
                title={t("search.clearInput")}
              >
                <X size={14} />
              </button>
            )}
            <button className="search-btn" onClick={handleSearch}>
              <Search size={16} />
              {t("common.search")}
            </button>
          </div>
        </div>

        <LanguageSwitch />

        <button
          className="tool-btn"
          onClick={() => navigate("/settings")}
          title={t("settings.title")}
        >
          <Settings size={16} />
        </button>

        <button
          className="tool-btn"
          onClick={() => navigate("/browser")}
          title={t("browser.title")}
        >
          <Globe size={16} />
        </button>

        <button
          className="source-btn"
          onClick={() => void chooseMetadata()}
          title={
            metadataPath
              ? t("search.sourceTitle", { path: metadataPath, count: metadataFileCount })
              : t("search.chooseMetadata")
          }
        >
          <FolderOpen size={16} />
          <span>
            {loading
              ? t("common.loading")
              : metadataPath
                ? metadataFileCount > 1
                  ? t("search.sourceCount", {
                      path: shortPath(metadataPath),
                      count: metadataFileCount,
                    })
                  : shortPath(metadataPath)
                : t("common.chooseData")}
          </span>
        </button>
      </div>

      {(open || appliedCount > 0) && (
        <div
          className="advanced-wrap"
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={() => setDraftOpen(true)}
        >
          {open && (
            <div className="advanced-panel">
              {FACETS.map(({ kind, labelKey }) => (
                <div className="filter-group" key={kind}>
                  <div className="filter-label">{t(labelKey)}</div>
                  <div className="chip-list">
                    {facets[kind].map((f) => (
                      <FilterChip
                        key={f.name}
                        label={f.name}
                        count={f.count}
                        active={draft[kind].includes(f.name)}
                        onToggle={() => toggleDraft(kind, f.name)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="panel-actions">
                <span className="panel-hint">{t("search.panelHint")}</span>
                <button
                  className="tool-btn"
                  onClick={() => {
                    clearDrafts();
                  }}
                >
                  <RotateCcw size={14} />
                  {t("common.reset")}
                </button>
                <button
                  className="tool-btn"
                  onClick={() => {
                    setAdvancedOpen(false);
                    setDraftOpen(false);
                  }}
                  title={t("search.closePanel")}
                >
                  <X size={14} />
                  {t("common.close")}
                </button>
              </div>
            </div>
          )}

          {appliedCount > 0 && (
            <div className="applied-filters">
              {criteria.query.trim() && (
                <button className="chip applied" onClick={() => applySearch()}>
                  {t("search.appliedQuery", { query: criteria.query.trim() })}
                </button>
              )}
              {FACETS.flatMap(({ kind }) =>
                criteria[kind].map((name) => (
                  <button
                    key={`${kind}:${name}`}
                    className="chip applied"
                    onClick={() => removeApplied(kind, name)}
                  >
                    {name}
                    <X size={12} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
