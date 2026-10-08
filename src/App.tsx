import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider } from "./components/Toast";
import {
  IconPeople,
  IconTarget,
  IconSettings,
  IconUpload,
  IconInfo,
} from "./components/icons";
import { HomeScreen } from "./screens/HomeScreen";
import { ImportScreen } from "./screens/ImportScreen";
import { JobMatchScreen } from "./screens/JobMatchScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { AboutScreen } from "./screens/AboutScreen";
import { FirstRunGate } from "./screens/FirstRunGate";
import { getSettings } from "./lib/api";
import { useI18n } from "./i18n/useI18n";
import type { AppSettings } from "./lib/types";

type Screen = "home" | "import" | "match" | "settings" | "about";

export default function App() {
  const { t } = useI18n();
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ready, setReady] = useState(false);

  const refreshSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    return s;
  };

  useEffect(() => {
    refreshSettings().finally(() => setReady(true));
  }, []);

  const nav: Array<{ id: Screen; label: string; icon: ReactNode }> = [
    { id: "home", label: t("nav.candidates"), icon: <IconPeople size={18} /> },
    { id: "import", label: t("nav.import"), icon: <IconUpload size={18} /> },
    { id: "match", label: t("nav.match"), icon: <IconTarget size={18} /> },
    { id: "settings", label: t("nav.settings"), icon: <IconSettings size={18} /> },
    { id: "about", label: t("nav.about"), icon: <IconInfo size={18} /> },
  ];

  return (
    <ToastProvider>
      {!ready ? (
        <div className="center-load">
          <div className="spinner" /> {t("common.loading")}
        </div>
      ) : !settings?.active_model ? (
        <FirstRunGate onReady={refreshSettings} />
      ) : (
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <img src="/icon.png" alt="" />
              <div>
                <h1>CandiShelf</h1>
                <span>{t("app.subtitle")}</span>
              </div>
            </div>
            {nav.map((n) => (
              <button
                key={n.id}
                className={`nav-item ${screen === n.id ? "active" : ""}`}
                onClick={() => setScreen(n.id)}
              >
                <span className="icon">{n.icon}</span>
                {n.label}
              </button>
            ))}
            <div className="sidebar-footer">
              <button
                className="btn ghost sm"
                style={{ padding: 0, color: "var(--text-faint)" }}
                onClick={() => setScreen("about")}
                title={t("app.aboutTitle")}
              >
                v{settings.version}
              </button>
            </div>
          </aside>
          <main className="main">
            <div className="main-inner">
              {screen === "home" && (
                <HomeScreen onImport={() => setScreen("import")} onMatch={() => setScreen("match")} />
              )}
              {screen === "import" && (
                <ImportScreen onDone={() => setScreen("home")} />
              )}
              {screen === "match" && <JobMatchScreen />}
              {screen === "settings" && (
                <SettingsScreen
                  settings={settings}
                  onChange={refreshSettings}
                />
              )}
              {screen === "about" && <AboutScreen />}
            </div>
          </main>
        </div>
      )}
    </ToastProvider>
  );
}
