import React from "react"
import { formatListCountForBadge } from "@/utils/listCountBadge.js"

/**
 * Count pill for page titles (pairs with main nav encounter badge tokens: #183278, rounded-full, bold).
 * Navy fill on light pages so the same brand read as the sidebar’s white pill on navy.
 */
export default function PageHeaderCountBadge({ count, className = "" }) {
  return (
    <span
      className={`inline-flex min-h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-full border border-[#11275C]/30 bg-[#183278] px-2.5 text-base font-bold tabular-nums text-white shadow-sm ${className}`}
    >
      {formatListCountForBadge(count)}
    </span>
  )
}
