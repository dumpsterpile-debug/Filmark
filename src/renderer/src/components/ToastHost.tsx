import { useAppStore } from "@/store/useAppStore";

export default function ToastHost(): JSX.Element {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}
