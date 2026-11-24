"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface px-3 py-2 text-sm">{url}</code>
      <button
        type="button"
        aria-label="Copiar enlace"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // portapapeles no disponible
          }
        }}
        className="rounded-lg border border-line bg-surface p-2 hover:bg-subtle cursor-pointer"
      >
        {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
      </button>
      <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir enlace" className="rounded-lg border border-line bg-surface p-2 hover:bg-subtle">
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}
