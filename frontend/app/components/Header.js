"use client";

import { MenuIcon } from "./Icons";

export default function Header({ activeTab, onOpenSidebar, serverOnline }) {
  const titles = {
    overview: {
      title: "Dashboard Overview",
      subtitle: "Manage, create, and monitor your shortened links",
    },
    links: {
      title: "My Links",
      subtitle: "Full history of your generated shortened URLs",
    },
    analytics: {
      title: "Analytics & Performance",
      subtitle: "View saved links and recorded redirects",
    },
  };

  const current = titles[activeTab] || titles.overview;

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          aria-label="Open sidebar"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight leading-tight">
            {current.title}
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <span className={`w-2 h-2 rounded-full ${serverOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          Express :5000
        </span>
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-medium text-xs flex items-center justify-center border border-indigo-200">
          DEV
        </div>
      </div>
    </header>
  );
}
