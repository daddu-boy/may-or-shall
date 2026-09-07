"use client";

import type { SourceReview } from "@/lib/groundedDraft";

export default function SourceReviewPanel({ review, matterId, edited = false }: { review: SourceReview; matterId: string; edited?: boolean }) {
  if (review.version !== 1 || !Array.isArray(review.claims)) return null;
  return (
    <details className="border border-amber-200 bg-amber-50 rounded p-3 my-3 text-sm" data-testid="source-review">
      <summary className="cursor-pointer font-medium">Review AI claims and sources ({review.claims.length})</summary>
      <p className="text-xs mt-2">Card references and quoted excerpts were checked at generation. Whether the evidence supports each claim still needs your review.</p>
      {edited && <p role="status" className="text-xs font-medium mt-2">The draft has been edited. This panel records the original AI claims; it does not validate your current text.</p>}
      <ol className="list-decimal pl-5 space-y-4 mt-3">
        {review.claims.map((claim, i) => (
          <li key={i}>
            <p>{claim.text}</p>
            {claim.kind === "analysis" && <p className="text-xs font-medium">AI analysis / proposed wording — review required</p>}
            {claim.sources.map((source, j) => (
              <div key={j} className="border-l-2 border-amber-300 pl-3 mt-2">
                <blockquote className="text-xs">“{source.quote}”</blockquote>
                <a className="text-xs underline" href={`/matters/${matterId}/cards?card=${encodeURIComponent(source.cardId)}`} target="_blank" rel="noreferrer">Open source card: {source.label}</a>
                {source.documentId && source.page && <a className="ml-3 text-xs underline" href={`/matters/${matterId}/documents/${encodeURIComponent(source.documentId)}?page=${source.page}`} target="_blank" rel="noreferrer">Open page image</a>}
              </div>
            ))}
          </li>
        ))}
      </ol>
    </details>
  );
}
