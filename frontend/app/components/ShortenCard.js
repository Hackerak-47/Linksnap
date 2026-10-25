"use client";

import { useState } from "react";
import { LinkIcon, CopyIcon, CheckIcon, ExternalLinkIcon, ChevronDownIcon } from "./Icons";

export default function ShortenCard({ onLinkCreated, apiBase }) {
  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [title, setTitle] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);


  function validateAndFormat(rawUrl) {
    let clean = rawUrl.trim();
    if (!clean) return { valid: false, error: "Please provide a destination URL." };

    if (!/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
      clean = `https://${clean}`;
    }

    try {
      const parsed = new URL(clean);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { valid: false, error: "Only HTTP and HTTPS protocols are supported." };
      }
      if (parsed.username || parsed.password) {
        return { valid: false, error: "URLs must not include credentials." };
      }
      return { valid: true, formatted: parsed.href };
    } catch {
      return { valid: false, error: "Please enter a valid URL." };
    }
  }

  async function handleShorten(e) {
    if (e) e.preventDefault();
    setErrorMessage("");
    setCopied(false);

    const check = validateAndFormat(url);
    if (!check.valid) {
      setErrorMessage(check.error);
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        url: check.formatted,
      };


      if (customAlias.trim()) payload.customAlias = customAlias.trim();
      if (title.trim()) payload.title = title.trim();

      const res = await fetch(`${apiBase}/api/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Unable to shorten URL. Server responded with an error.");
        return;
      }

      setSuccessData(data);
      if (onLinkCreated) {
        onLinkCreated(data);
      }
    } catch (err) {
      setErrorMessage(
        `Failed to reach backend at ${apiBase}. Ensure your Node.js/Express server is active.`
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!successData?.shortCode) return;
    const fullUrl = `${apiBase}/${successData.shortCode}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }

  function handleReset() {
    setUrl("");
    setCustomAlias("");
    setTitle("");
    setSuccessData(null);
    setErrorMessage("");
    setCopied(false);
  }

  const fullShortUrl = successData ? `${apiBase}/${successData.shortCode}` : "";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8">

      <form onSubmit={handleShorten} className="space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="url-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Shorten a Long Link
          </label>
          {url && !successData && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              Clear input
            </button>
          )}
        </div>


        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <LinkIcon className="w-5 h-5" />
            </div>
            <input
              id="url-input"
              type="text"
              inputMode="url"
              maxLength={4096}
              placeholder="Paste your long link here (e.g. https://github.com/my-project/very-long-path)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              className="w-full pl-11 pr-4 py-3 text-sm sm:text-base text-slate-900 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400 disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm sm:text-base transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Shortening...</span>
              </>
            ) : (
              <>
                <span>Shorten URL</span>
                <span className="text-indigo-200 text-xs font-mono hidden sm:inline">↵</span>
              </>
            )}
          </button>
        </div>


        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            <span>Advanced Options</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Custom Alias (Optional)
                </label>
                <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:border-indigo-500">
                  <span className="px-2.5 text-slate-400 font-mono text-xs border-r border-slate-100 bg-slate-50 py-2">
                    /
                  </span>
                  <input
                    type="text"
                    placeholder="my-portfolio"
                    minLength={3}
                    maxLength={32}
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    className="w-full px-2.5 py-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Letters, numbers, dashes</p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Link Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Portfolio GitHub"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Helpful for organizing links</p>
              </div>
            </div>
          )}
        </div>
      </form>


      {errorMessage && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
          <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium">{errorMessage}</p>
          </div>
        </div>
      )}


      {successData && (
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                Short link ready
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Shorten another URL
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">Short:</span>
                <a
                  href={fullShortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm sm:text-base font-semibold text-indigo-600 hover:text-indigo-800 hover:underline truncate"
                >
                  {fullShortUrl}
                </a>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white shadow-2xs"
                  }`}
                >
                  {copied ? (
                    <>
                      <CheckIcon className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-3.5 h-3.5" />
                      <span>Copy link</span>
                    </>
                  )}
                </button>

                <a
                  href={fullShortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLinkIcon className="w-4 h-4" />
                </a>
              </div>
            </div>


            <div className="mt-3 px-1 flex items-center gap-1.5 text-xs text-slate-500 overflow-hidden">
              <span className="shrink-0 font-medium text-slate-400">Destination:</span>
              <span className="truncate font-mono text-slate-600">{successData.originalUrl}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
