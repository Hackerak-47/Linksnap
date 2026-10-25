"use client";

import { LinkIcon, AnalyticsIcon, SparklesIcon } from "./Icons";

export default function StatsCards({ stats }) {
  const totalLinks = stats?.totalLinks || 0;

  const totalClicks = stats?.totalClicks || 0;
  const activeLinks = totalLinks;


  const topLink = stats?.topLink;
  if (!stats) return <p className="text-sm text-slate-500">Statistics are not available yet.</p>;

  const cards = [
    {
      title: "Total Links Created",
      value: totalLinks.toLocaleString(),
      subtitle: totalLinks === 0 ? "No links created yet" : `${totalLinks} active in database`,
      badge: "Saved",
      icon: LinkIcon,
      badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    {
      title: "Total Clicks",
      value: totalClicks.toLocaleString(),
      subtitle: totalClicks === 0 ? "Tracking enabled" : "Across all links",
      badge: totalClicks > 0 ? "Live tracked" : "Awaiting clicks",
      icon: AnalyticsIcon,
      badgeColor: totalClicks > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200",
    },
    {
      title: "Active Status",
      value: `${activeLinks} / ${totalLinks}`,
      subtitle: totalLinks === 0 ? "Ready to shorten" : "Links do not expire",
      badge: "Stored",
      icon: SparklesIcon,
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      title: "Most Popular Link",
      value: topLink ? (topLink.shortCode ? `/${topLink.shortCode}` : "—") : "None",
      subtitle: topLink ? `${Number(topLink.clicks) || 0} clicks recorded` : "Shorten a URL to begin",
      badge: topLink ? "Top" : "Awaiting data",
      icon: LinkIcon,
      badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {card.title}
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-100">
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {card.value}
              </div>
              <span className={`text-[10px] font-medium font-mono px-1.5 py-0.5 rounded-full border ${card.badgeColor}`}>
                {card.badge}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-2 truncate">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
