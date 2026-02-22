"use client";

import { useState, useMemo } from "react";
import { StreakData, STREAK_THRESHOLD } from "@/hooks/useStreak";
import FlameIcon from "@/components/FlameIcon";

interface Props {
  open: boolean;
  onClose: () => void;
  streakData: StreakData;
}

type ChartView = "Week" | "Month" | "Year";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Returns last N date strings starting from today
function lastNDays(n: number): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(toDateStr(d));
  }
  return result;
}

// Returns last N months as YYYY-MM
function lastNMonths(n: number): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    result.push(d.toISOString().slice(0, 7)); // YYYY-MM
  }
  return result;
}

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function StreakPanel({ open, onClose, streakData }: Props) {
  const [chartView, setChartView] = useState<ChartView>("Week");

  // Bar chart data
  const chartData = useMemo(() => {
    const { dailyTimes } = streakData;

    if (chartView === "Week") {
      // Current week Mon-Sun (7 days ending today)
      const days = lastNDays(7);
      return days.map((dateStr) => {
        const d = new Date(dateStr + "T00:00:00");
        return {
          label: DAY_ABBR[d.getDay()],
          subLabel: String(d.getDate()),
          seconds: dailyTimes[dateStr] ?? 0,
        };
      });
    }

    if (chartView === "Month") {
      // Last 30 days, grouped — show day numbers
      const days = lastNDays(30);
      // Show every 5th label to avoid crowding
      return days.map((dateStr, i) => {
        const d = new Date(dateStr + "T00:00:00");
        return {
          label: i % 5 === 0 ? String(d.getDate()) : "",
          subLabel: "",
          seconds: dailyTimes[dateStr] ?? 0,
        };
      });
    }

    // Year — last 12 months
    const months = lastNMonths(12);
    const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((monthStr) => {
      const month = Number(monthStr.slice(5, 7)) - 1;
      // Sum all days in this month
      const totalSecs = Object.entries(dailyTimes)
        .filter(([d]) => d.startsWith(monthStr))
        .reduce((sum, [, s]) => sum + s, 0);
      return {
        label: MONTH_ABBR[month],
        subLabel: "",
        seconds: totalSecs,
      };
    });
  }, [chartView, streakData]);

  const maxSecs = Math.max(...chartData.map((d) => d.seconds), 1);

  // Y-axis labels (in minutes)
  const maxMins = Math.ceil(maxSecs / 60);
  const yTicks = [0, Math.round(maxMins * 0.33), Math.round(maxMins * 0.66), maxMins].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  const totalSeconds = Object.values(streakData.dailyTimes).reduce((s, v) => s + v, 0);
  const todayPct = Math.min(
    100,
    Math.round(((streakData.todaySeconds ?? 0) / STREAK_THRESHOLD) * 100)
  );

  const today = toDateStr(new Date());

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel — slides in from right */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 bg-[#0d0d0d] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-4">
          <button onClick={onClose} className="text-gray-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h2 className="text-white text-lg font-semibold flex-1">Statistics</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 scrollbar-hide">
          {/* Top stats row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-gray-400 text-sm">
                <span className="text-orange-400 font-semibold">{streakData.totalDays} day{streakData.totalDays !== 1 ? "s" : ""}</span> of listening
              </p>
              <p className="text-gray-600 text-xs mt-0.5">
                {streakData.totalDays} lecture{streakData.totalDays !== 1 ? "s" : ""} so far
              </p>
            </div>
            <div className="flex items-center gap-2">
              <FlameIcon size={32} lit={streakData.currentStreak > 0} animated />
              <div className="text-right">
                <p className="text-white text-xl font-bold leading-none">
                  {streakData.currentStreak} day{streakData.currentStreak !== 1 ? "s" : ""}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {streakData.longestStreak} best streak
                </p>
              </div>
            </div>
          </div>

          {/* Today progress toward 10-min goal */}
          {!streakData.listenedToday && (
            <div className="bg-[#1a1208] rounded-xl p-4 mb-5 border border-orange-900/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium">Today&apos;s goal</p>
                <p className="text-orange-400 text-sm font-semibold">
                  {formatTime(streakData.todaySeconds)} / 10m
                </p>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500"
                  style={{ width: `${todayPct}%` }}
                />
              </div>
              <p className="text-gray-500 text-xs mt-1.5">
                Listen {formatTime(Math.max(0, STREAK_THRESHOLD - (streakData.todaySeconds ?? 0)))} more to keep your streak!
              </p>
            </div>
          )}

          {streakData.listenedToday && (
            <div className="bg-[#1a2208] rounded-xl p-4 mb-5 border border-green-900/40 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-400">
                  <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-green-400 text-sm font-semibold">Streak maintained!</p>
                <p className="text-gray-500 text-xs">You&apos;ve listened {formatTime(streakData.todaySeconds)} today</p>
              </div>
            </div>
          )}

          {/* Chart view selector */}
          <div className="bg-[#1a1a1a] rounded-xl p-1 flex mb-4">
            {(["Year", "Week", "Month"] as ChartView[]).map((v) => (
              <button
                key={v}
                onClick={() => setChartView(v)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  chartView === v
                    ? "bg-orange-500 text-white"
                    : "text-gray-400"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-[#111] rounded-xl p-4 mb-5">
            <div className="flex gap-1 h-40 items-end">
              {/* Y-axis */}
              <div className="flex flex-col justify-between h-full pr-1 text-right">
                {[...yTicks].reverse().map((tick) => (
                  <span key={tick} className="text-gray-600 text-[9px] leading-none">
                    {tick}m
                  </span>
                ))}
              </div>

              {/* Bars */}
              <div className="flex-1 flex gap-0.5 items-end h-full">
                {chartData.map((bar, i) => {
                  const heightPct = maxSecs > 0 ? (bar.seconds / maxSecs) * 100 : 0;
                  const isToday =
                    chartView === "Week" &&
                    toDateStr(
                      new Date(Date.now() - (chartData.length - 1 - i) * 86400000)
                    ) === today;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={`w-full rounded-t-sm transition-all duration-500 ${
                            bar.seconds >= STREAK_THRESHOLD
                              ? "bg-orange-400"
                              : bar.seconds > 0
                              ? "bg-orange-800"
                              : "bg-gray-800"
                          }`}
                          style={{ height: `${Math.max(heightPct, bar.seconds > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      {bar.label && (
                        <span
                          className={`text-[8px] leading-none ${
                            isToday ? "text-orange-400 font-bold" : "text-gray-600"
                          }`}
                        >
                          {bar.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Progress since joined */}
          <div className="bg-[#111] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center">
                  <span className="text-gray-500 text-[10px] font-bold">i</span>
                </div>
                <span className="text-white text-sm font-medium">Progress since you joined</span>
              </div>
              <span className="text-gray-500 text-xs border border-gray-700 rounded-lg px-2 py-1">
                All Time
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <p className="text-white text-2xl font-bold">{formatTime(totalSeconds)}</p>
                <p className="text-gray-500 text-xs">listened</p>
              </div>

              {/* Concentric ring decoration */}
              <div className="flex-1 flex justify-center">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {[36, 30, 24, 18, 12].map((r, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full border"
                      style={{
                        width: r * 2,
                        height: r * 2,
                        borderColor: [
                          "#3b82f6",
                          "#ef4444",
                          "#a16207",
                          "#15803d",
                          "#7c3aed",
                        ][i],
                        opacity: 0.4 - i * 0.06,
                      }}
                    />
                  ))}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#f97316" className="w-5 h-5 opacity-70">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Streak info row */}
            <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <FlameIcon size={20} lit={streakData.currentStreak > 0} />
                <div>
                  <p className="text-white text-sm font-semibold">{streakData.currentStreak} day{streakData.currentStreak !== 1 ? "s" : ""}</p>
                  <p className="text-gray-600 text-xs">current streak</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FlameIcon size={20} lit />
                <div>
                  <p className="text-white text-sm font-semibold">{streakData.longestStreak} day{streakData.longestStreak !== 1 ? "s" : ""}</p>
                  <p className="text-gray-600 text-xs">best streak</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
