"use client";

import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import ShortenCard from "./components/ShortenCard";
import RecentLinksTable from "./components/RecentLinksTable";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function Home() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);

  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const controller = new AbortController();
    let requestId = 0;
    async function refresh() {
      const id = ++requestId;
      setLoading(true);
      try {
        const query = new URLSearchParams({ search: searchTerm, sort: sortOrder, limit: "25", offset: String(offset) });
        const responses = await Promise.all(["/api/health", `/api/links?${query}`, "/api/stats"].map(path => fetch(`${API_BASE}${path}`, { signal: controller.signal })));
        if (responses.some(res => !res.ok)) throw new Error("Could not load links from the backend.");
        const [, data, summary] = await Promise.all(responses.map(res => res.json()));
        if (controller.signal.aborted || id !== requestId) return;
        if (offset > 0 && data.links.length === 0) setOffset(Math.max(0, offset - 25));
        setLinks(data.links);
        setTotal(data.total);
        setStats(summary);
        setServerOnline(true);
        setError("");
      } catch (err) {
        if (controller.signal.aborted || id !== requestId) return;
        setServerOnline(false);
        setError(err.message);
      } finally {
        if (!controller.signal.aborted && id === requestId) setLoading(false);
      }
    }
    const debounce = setTimeout(refresh, 200);
    const interval = setInterval(refresh, 15000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      clearTimeout(debounce);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [searchTerm, sortOrder, offset, revision]);


  function handleLinkCreated() {
    setOffset(0);
    setSearchTerm("");
    setRevision(value => value + 1);
  }


  async function handleDeleteLink(shortCode) {
    const res = await fetch(`${API_BASE}/api/links/${encodeURIComponent(shortCode)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not delete link");
    setRevision(value => value + 1);
  }

  const tableProps = { links, onDeleteLink: handleDeleteLink, apiBase: API_BASE,
    searchTerm, sortOrder, total, offset, loading,
    onSearch: value => { setSearchTerm(value); setOffset(0); },
    onSort: value => { setSortOrder(value); setOffset(0); }, onPage: setOffset };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        serverOnline={serverOnline}
      />


      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          onOpenSidebar={() => setSidebarOpen(true)}
          serverOnline={serverOnline}
        />

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-8">
          {error && <p role="alert" className="text-sm text-rose-700">{error} Displayed data may be stale.</p>}

          {!serverOnline && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>
                  <strong>Backend server offline:</strong> Cannot reach {API_BASE}. Make sure your Express server is running on port 5000.
                </span>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                node backend/server.js
              </span>
            </div>
          )}


          {activeTab === "overview" && (
            <div className="space-y-8">

              <StatsCards stats={stats} />


              <ShortenCard
                onLinkCreated={handleLinkCreated}
                apiBase={API_BASE}
              />


              <RecentLinksTable {...tableProps} />
            </div>
          )}


          {activeTab === "links" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    All Shortened Links
                  </h2>
                  <p className="text-xs text-slate-500">
                    Search, filter, and manage your generated links
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("overview")}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                >
                  + Shorten New URL
                </button>
              </div>

              <RecentLinksTable {...tableProps} />
            </div>
          )}


          {activeTab === "analytics" && <div className="space-y-4"><StatsCards stats={stats} /><p className="text-sm text-slate-500">Counts reflect redirects issued for currently saved links. Refreshes every 15 seconds. These are not unique visitors; bots and repeated visits can count.</p></div>}
        </main>


        <footer className="border-t border-slate-200/80 py-6 px-4 sm:px-8 mt-auto bg-white/50">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p className="font-medium">
              LinkSnap Developer Edition • Next.js & Express
            </p>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span>API: {API_BASE}</span>
              <span>•</span>
              <span className="text-slate-600 font-semibold">Local workspace</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
