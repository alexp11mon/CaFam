"use client";

import { Button } from "@/components/ui/button";
import type { UploadItem } from "./use-image-uploads";

const STATUS_TEXT: Record<UploadItem["status"], string> = {
  preparing: "Preparando…",
  ready: "En espera",
  uploading: "Subiendo…",
  failed: "",
};

/** Images on their way, each with its progress, cancel and retry (spec 012 RF-6, RF-24). */
export function UploadList({
  items,
  notice,
  onCancel,
  onRetry,
}: {
  items: UploadItem[];
  notice?: string;
  onCancel: (key: string) => void;
  onRetry: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="text-sm text-muted empty:hidden">
        {notice}
      </p>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-col gap-2 rounded-2xl border border-line px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {item.name}
                </span>
                {item.status === "failed" ? (
                  item.retryable ? (
                    <Button
                      variant="secondary"
                      onClick={() => onRetry(item.key)}
                    >
                      Reintentar
                    </Button>
                  ) : null
                ) : (
                  <span className="text-sm text-muted">
                    {STATUS_TEXT[item.status]}
                  </span>
                )}
                <Button
                  variant="secondary"
                  onClick={() => onCancel(item.key)}
                  aria-label={
                    item.status === "failed"
                      ? "Quitar"
                      : `Cancelar ${item.name}`
                  }
                >
                  {item.status === "failed" ? "Quitar" : "Cancelar"}
                </Button>
              </div>
              {item.status === "failed" ? (
                <p role="alert" className="text-sm text-danger">
                  {item.error}
                </p>
              ) : (
                <div
                  role="progressbar"
                  aria-label={`Subiendo ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className="h-1.5 overflow-hidden rounded-full bg-line"
                >
                  <div
                    className="h-full rounded-full bg-ink transition-[width] duration-150"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
