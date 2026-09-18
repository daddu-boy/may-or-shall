import { prisma } from "@/lib/db";
import { CARD_TYPES, CARD_TYPE_LABEL, type CardTypeValue } from "@/lib/labels";

/**
 * Categories people invent for themselves.
 *
 * The ten built in types are a litigator's vocabulary; they are not everyone's.
 * A custom category is stored in the same Card.cardType column as a built in,
 * distinguished only by its CUSTOM_ prefix, so nothing downstream (search,
 * grouping, export, the connector) has to learn a second concept.
 */
export const CUSTOM_PREFIX = "CUSTOM_";
export const MAX_CATEGORIES = 12;
export const MAX_LABEL = 24;

export function isCustomType(type: string): boolean {
  return type.startsWith(CUSTOM_PREFIX);
}

/** A stable key from what the person typed. Two categories never share one. */
export function keyFor(label: string, taken: string[] = []): string {
  const base =
    label
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "CATEGORY";
  let key = CUSTOM_PREFIX + base;
  let n = 2;
  while (taken.includes(key)) key = `${CUSTOM_PREFIX}${base}_${n++}`;
  return key;
}

export interface CategoryDto {
  id: string;
  key: string;
  label: string;
  color: string;
}

export async function categoriesFor(userId: string): Promise<CategoryDto[]> {
  return prisma.cardCategory.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, key: true, label: true, color: true },
  });
}

/**
 * Whether this account may file a card under this type. Anything unknown is
 * refused rather than stored, so a typo cannot create a category by accident.
 */
export async function typeIsAllowed(userId: string, type: string): Promise<boolean> {
  if ((CARD_TYPES as readonly string[]).includes(type)) return true;
  if (!isCustomType(type)) return false;
  return !!(await prisma.cardCategory.findUnique({
    where: { userId_key: { userId, key: type } },
    select: { id: true },
  }));
}

/** Label for any type, built in or invented, for exports and the connector. */
export function labelWith(type: string, categories: CategoryDto[]): string {
  const custom = categories.find((c) => c.key === type);
  if (custom) return custom.label;
  return CARD_TYPE_LABEL[type as CardTypeValue] ?? type;
}
