"use client";

import { OverviewIcon, LinksIcon, AnalyticsIcon, LinkIcon, CloseIcon } from "./Icons";

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen, serverOnline }) {
  const navItems = [
    { id: "overview", label: "Overview", icon: OverviewIcon },
    { id: "links", label: "My Links", icon: LinksIcon },
    { id: "analytics", label: "Analytics", icon: AnalyticsIcon },
  ];

  return (
    <>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}


      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >

        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-slate-900 tracking-tight text-base block leading-tight">
                LinkSnap
              </span>
              <span className="text-[10px] font-mono font-medium text-slate-400 block uppercase tracking-wider">
                URL Shortener
              </span>
            </div>
          </div>


          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-700 p-1 rounded-lg"
            aria-label="Close menu"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>


        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Workspace
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>

              </button>
            );
          })}
        </div>


        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700">API Status</span>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${
                serverOnline ? "text-emerald-700" : "text-amber-700"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  serverOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}></span>
                {serverOnline ? "Connected" : "Offline"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              http://localhost:5000
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
