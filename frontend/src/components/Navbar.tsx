import React, { useLayoutEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Database,
  BarChart2,
  Sliders,
  Layers,
  Sparkles,
  GitCompare,
  Info,
} from "lucide-react";

export type NavTab =
  | "overview"
  | "quality"
  | "eda"
  | "pca"
  | "clusters"
  | "try"
  | "comparison"
  | "about";

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isReady: boolean;
}

export const Navbar: React.FC<Props> = ({ activeTab, onSelectTab, isReady }) => {
  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "quality", label: "Dataset & Quality", icon: Database },
    { id: "eda", label: "Explore the Data", icon: BarChart2 },
    { id: "pca", label: "PCA Dimension Lab", icon: Sliders },
    { id: "clusters", label: "Cluster Explorer", icon: Layers },
    { id: "try", label: "Try a Reading", icon: Sparkles },
    { id: "comparison", label: "Method Comparison", icon: GitCompare },
    { id: "about", label: "About / Team", icon: Info },
  ] as const;

  // Liquid "lens" that glides under the active tab.
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [lens, setLens] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current[activeTab];
      if (el) {
        setLens({ left: el.offsetLeft, width: el.offsetWidth });
        el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTab]);

  return (
    <header className="lg-header">
      {/* Brand row */}
      <div className="px-5 sm:px-6 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 flex items-center justify-center"
            style={{
              borderRadius: 15,
              background: "linear-gradient(160deg,#2fa07c 0%,#0d5a43 100%)",
              boxShadow: "inset 0 1.5px 0 rgb(255 255 240 / 55%), inset 0 -2px 4px rgb(0 40 25 / 35%), 0 10px 22px -8px rgb(13 90 67 / 60%)",
            }}
            aria-label="Solar and wind"
          >
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="6.2" fill="#f2a20c" />
              <g stroke="#ffd27a" strokeWidth="1.6" strokeLinecap="round">
                <path d="M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3M7.2 7.2l2.1 2.1M22.7 22.7l2.1 2.1M7.2 24.8l2.1-2.1M22.7 9.3l2.1-2.1" />
              </g>
              <g fill="#fffdf2" opacity=".96">
                <path d="M16 16 L14.6 5.5 Q16 4.4 17.4 5.5 Z" />
                <path d="M16 16 L25.3 21.4 Q25.2 23.1 23.6 23.3 Z" />
                <path d="M16 16 L6.7 21.4 Q6.8 23.1 8.4 23.3 Z" />
              </g>
              <circle cx="16" cy="16" r="1.7" fill="#14352b" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] sm:text-[19px] font-semibold text-[#14352b]">
                Renewable Energy Pattern Discovery
              </h1>
              <span
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full hidden sm:inline"
                style={{ background: "rgb(242 162 12 / 20%)", color: "#a36100" }}
              >
                PCA + GMM
              </span>
            </div>
            <p className="text-[11.5px]" style={{ color: "rgb(60 60 67 / 62%)" }}>
              21CSE305P Introduction to Machine Learning · CTECH Department · Batch 9
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-medium"
          style={{
            background: "linear-gradient(180deg, rgb(255 255 255 / 72%), rgb(255 255 255 / 40%))",
            border: "1px solid rgb(255 255 255 / 70%)",
            boxShadow: "inset 0 1.5px 0 rgb(255 255 255 / 90%), 0 6px 16px -8px rgb(20 30 80 / 25%)",
            color: "#14352b",
          }}
        >
          <span
            className={`w-2 h-2 rounded-full ${isReady ? "animate-pulse" : ""}`}
            style={{
              background: isReady ? "#30d158" : "#ff9f0a",
              boxShadow: isReady ? "0 0 8px #30d158" : "0 0 8px #ff9f0a",
            }}
          />
          {isReady ? "Dataset & Model Ready" : "Initializing…"}
        </div>
      </div>

      {/* Segmented glass tab control */}
      <div className="px-3 sm:px-5 pb-4 overflow-x-auto scrollbar-none">
        <nav className="lg-tabs" aria-label="Sections">
          {lens && <span aria-hidden className="lg-lens" style={{ left: lens.left, width: lens.width }} />}
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  btnRefs.current[tab.id] = el;
                }}
                className="lg-tab"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelectTab(tab.id as NavTab)}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
