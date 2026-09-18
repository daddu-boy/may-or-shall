"use client";

import { useEffect, useState } from "react";
import { api, type CategoryDto } from "@/lib/clientTypes";
import { CARD_TYPE_COLOR, CARD_TYPE_LABEL, cardTypeLabel, type CardTypeValue, type MatterKind } from "@/lib/labels";

/**
 * The account's own card categories, shared by everything that draws a card.
 *
 * A card carries its type as a string, and a custom type means nothing to the
 * built in label and colour tables. Rather than thread a list through every
 * card, panel and drawer, the categories are fetched once per page and handed
 * to whoever asks. Kept deliberately small: one cache, one request, no store.
 */
let cache: CategoryDto[] | null = null;
let inflight: Promise<CategoryDto[]> | null = null;
const listeners = new Set<(c: CategoryDto[]) => void>();

function publish(next: CategoryDto[]) {
  cache = next;
  listeners.forEach((f) => f(next));
}

/** Re-read after the user adds or deletes one, so every card relabels at once. */
export async function refreshCardTypes(): Promise<void> {
  try {
    publish(await api<CategoryDto[]>("/api/card-types"));
  } catch {
    /* the built in types still work; a failed refresh is not worth an alert */
  }
}

export interface CardTypeLookup {
  categories: CategoryDto[];
  labelOf: (type: string, kind?: MatterKind) => string;
  colorOf: (type: string) => string;
}

export function useCardTypes(): CardTypeLookup {
  const [categories, setCategories] = useState<CategoryDto[]>(cache ?? []);

  useEffect(() => {
    listeners.add(setCategories);
    if (cache) setCategories(cache);
    else {
      inflight ??= api<CategoryDto[]>("/api/card-types")
        .then((c) => {
          publish(c);
          return c;
        })
        .catch(() => [] as CategoryDto[])
        .finally(() => {
          inflight = null;
        });
    }
    return () => {
      listeners.delete(setCategories);
    };
  }, []);

  return {
    categories,
    labelOf: (type, kind = "CASE") => {
      const custom = categories.find((c) => c.key === type);
      if (custom) return custom.label;
      if (type in CARD_TYPE_LABEL) return cardTypeLabel(type as CardTypeValue, kind);
      return type;
    },
    colorOf: (type) =>
      categories.find((c) => c.key === type)?.color ?? CARD_TYPE_COLOR[type as CardTypeValue] ?? "#6b7280",
  };
}
