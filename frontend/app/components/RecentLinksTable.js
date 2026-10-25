"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon, ExternalLinkIcon, TrashIcon, SearchIcon, LinkIcon } from "./Icons";

export default function RecentLinksTable({ links = [], onDeleteLink, apiBase, searchTerm, sortOrder, onSearch, onSort, total, offset, onPage, loading }) {
  const [copiedCode, setCopiedCode] = useState(null);
  const [linkToDelete, setLinkToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");


  async function handleCopy(shortCode) {
    const fullUrl = `${apiBase}/${shortCode}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedCode(shortCode);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }


  const sorted = links;

  async function confirmDelete() {
    if (linkToDelete && onDeleteLink) {
      setDeleting(true);
      setDeleteError("");
      try {
        await onDeleteLink(linkToDelete.shortCode);
        setLinkToDelete(null);
      } catch (err) { setDeleteError(err.message || "Could not delete link"); }
      finally { setDeleting(false); }
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">

      <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">
            Recent Links
          </h2>
          <p className="text-xs text-slate-500">
            {total} matching links {loading ? "(refreshing...)" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2.5">

          <div className="relative flex-1 sm:w-60">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <SearchIcon className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search links..."
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
              maxLength={200}
              className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-indigo-500"
            />
          </div>


          <select
            value={sortOrder}
            onChange={(e) => onSort(e.target.value)}
            className="px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="clicks">Most clicks</option>
          </select>
        </div>
      </div>


      {sorted.length === 0 ? (
        <div className="py-16 px-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <LinkIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            {searchTerm ? "No matching links found" : "No shortened links yet"}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `No links matched your query "${searchTerm}". Try a different term or clear your search.`
              : "Paste any long URL into the box above to generate your first clean short link."}
          </p>
          {searchTerm && (
            <button
              onClick={() => onSearch("")}
              className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Clear search filter
            </button>
          )}
        </div>
      ) : (
        <>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-medium border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4 font-semibold">Short Link</th>
                  <th className="py-3 px-4 font-semibold">Original Destination</th>
                  <th className="py-3 px-4 font-semibold">Created</th>
                  <th className="py-3 px-4 font-semibold text-center">Clicks</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sorted.map((item) => {
                  const fullUrl = `${apiBase}/${item.shortCode}`;
                  const isCopied = copiedCode === item.shortCode;
                  const dateStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Just now";

                  return (
                    <tr key={item.shortCode} className="hover:bg-slate-50/60 transition-colors">

                      <td className="py-3 px-4 font-mono font-medium">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            /{item.shortCode}
                          </a>
                        </div>
                        {item.title && (
                          <span className="block text-[11px] text-slate-400 font-sans truncate max-w-[140px]">
                            {item.title}
                          </span>
                        )}
                      </td>


                      <td className="py-3 px-4 font-mono text-slate-500 max-w-[280px]">
                        <span className="truncate block" title={item.originalUrl}>
                          {item.originalUrl}
                        </span>
                      </td>


                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {dateStr}
                      </td>


                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-900">
                        {Number(item.clicks) || 0}
                      </td>


                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </td>


                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.shortCode)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                            title="Copy short link"
                          >
                            {isCopied ? (
                              <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <CopyIcon className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <a
                            href={item.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                            title="Visit original destination"
                          >
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                          </a>

                          {onDeleteLink && (
                            <button
                              type="button"
                              onClick={() => setLinkToDelete(item)}
                              className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete link"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>


          <div className="md:hidden divide-y divide-slate-100">
            {sorted.map((item) => {
              const fullUrl = `${apiBase}/${item.shortCode}`;
              const isCopied = copiedCode === item.shortCode;

              return (
                <div key={item.shortCode} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm font-semibold text-indigo-600 hover:underline"
                    >
                      /{item.shortCode}
                    </a>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-mono truncate" title={item.originalUrl}>
                    {item.originalUrl}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>{Number(item.clicks) || 0} clicks</span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(item.shortCode)}
                        className="p-1.5 rounded-md bg-slate-100 text-slate-600"
                        title="Copy"
                      >
                        {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5" />}
                      </button>

                      <a
                        href={item.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md bg-slate-100 text-slate-600"
                        title="Open original"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </a>

                      {onDeleteLink && (
                        <button
                          onClick={() => setLinkToDelete(item)}
                          className="p-1.5 rounded-md bg-rose-50 text-rose-600"
                          title="Delete"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}


      <div className="flex justify-between items-center p-4 text-xs">
        <button disabled={offset === 0 || loading} onClick={() => onPage(Math.max(0, offset - 25))}>Previous</button>
        <span>{total ? `${offset + 1}–${offset + links.length} of ${total}` : "0 links"}</span>
        <button disabled={offset + 25 >= total || loading} onClick={() => onPage(offset + 25)}>Next</button>
      </div>
      {linkToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrashIcon className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Delete Short Link?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <span className="font-mono text-slate-800">/{linkToDelete.shortCode}</span>? Anyone using this link will receive a 404 error.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              {deleteError && <p role="alert" className="text-xs text-rose-700">{deleteError}</p>}
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setLinkToDelete(null); setDeleteError(""); }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Delete Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
