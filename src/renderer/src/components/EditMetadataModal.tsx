import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Save } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function EditMetadataModal() {
  const { t } = useTranslation();
  const editingVideo = useAppStore((s) => s.editingVideo);
  const clearEditingVideo = useAppStore((s) => s.clearEditingVideo);
  const updateVideo = useAppStore((s) => s.updateVideo);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [character, setCharacter] = useState("");
  const [genre, setGenre] = useState("");
  const [tags, setTags] = useState("");

  // Pre-fill form when modal opens
  useEffect(() => {
    if (editingVideo) {
      setTitle(editingVideo.title ?? "");
      setArtist(Array.isArray(editingVideo.artist) ? editingVideo.artist.join(", ") : "");
      setCharacter(Array.isArray(editingVideo.character) ? editingVideo.character.join(", ") : "");
      setGenre(editingVideo.genre ?? "");
      setTags(Array.isArray(editingVideo.tags) ? editingVideo.tags.join(", ") : "");
    }
  }, [editingVideo]);

  if (!editingVideo) return null;

  function handleSave() {
    const vid = useAppStore.getState().editingVideo;
    if (!vid) return;
    void updateVideo(vid.id, {
      title,
      artist: artist
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      character: character
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      genre,
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="modal-overlay" onClick={clearEditingVideo}>
      <div className="modal-box edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("edit.metaTitle")}</h2>
          <button className="modal-close" onClick={clearEditingVideo}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <label className="form-label">
            <span>{t("edit.fieldTitle")}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="form-label">
            <span>{t("edit.fieldArtist")}</span>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} />
          </label>

          <label className="form-label">
            <span>{t("edit.fieldCharacter")}</span>
            <input value={character} onChange={(e) => setCharacter(e.target.value)} />
          </label>

          <label className="form-label">
            <span>{t("edit.fieldGenre")}</span>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} />
          </label>

          <label className="form-label">
            <span>{t("edit.fieldTags")}</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={clearEditingVideo}>
            {t("download.cancel")}
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} />
            {t("edit.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
