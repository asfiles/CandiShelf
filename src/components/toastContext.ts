import { createContext } from "react";

export type ToastKind = "info" | "success" | "error";

export interface ToastCtx {
  push: (message: string, kind?: ToastKind) => void;
}

export const ToastContext = createContext<ToastCtx | null>(null);
