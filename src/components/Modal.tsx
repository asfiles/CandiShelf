import type { ReactNode } from "react";
import { IconClose } from "./icons";
import { useI18n } from "../i18n/useI18n";

export function Drawer({
  title,
  onClose,
  children,
  actions,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div>{title}</div>
          <div className="row">
            {actions}
            <button
              className="btn ghost sm"
              onClick={onClose}
              aria-label={t("common.close")}
            >
              <IconClose size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="overlay dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="card" role="alertdialog" aria-modal="true">
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ color: "var(--text-dim)" }}>{message}</p>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button className="btn ghost" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button
            className={`btn ${danger ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
