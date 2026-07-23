// One-time data migration: Postgres (old) -> SQLite (new).
// Usage: PG_URL="postgresql://..." node scripts/migrate-pg-to-sqlite.mjs
// Copies every table in dependency order, stringifying the fields that
// became JSON-text columns on SQLite (paraMap, rects, tags, linkedCardIds).
import { PrismaClient as PgClient } from "../node_modules/.prisma-pg-client/index.js";
import { PrismaClient as LiteClient } from "@prisma/client";

const pg = new PgClient();
const lite = new LiteClient();

const j = (v) => JSON.stringify(v ?? []);

try {
  const matters = await pg.matter.findMany();
  const documents = await pg.document.findMany();
  const pages = await pg.documentPage.findMany();
  const cards = await pg.card.findMany();
  const sheets = await pg.traverseSheet.findMany();
  const rows = await pg.traverseRow.findMany();
  const artefacts = await pg.generatedArtefact.findMany();
  const annexures = await pg.annexureItem.findMany();
  const tokens = await pg.apiToken.findMany();
  const chrono = await pg.chronologyEntry.findMany();

  console.log(
    `from PG: ${matters.length} matters, ${documents.length} docs, ${cards.length} cards, ` +
      `${rows.length} traverse rows, ${artefacts.length} artefacts, ${chrono.length} chronology, ` +
      `${tokens.length} tokens`
  );

  for (const m of matters) await lite.matter.create({ data: m });
  for (const d of documents) await lite.document.create({ data: { ...d, paraMap: j(d.paraMap) } });
  for (const p of pages) await lite.documentPage.create({ data: p });
  for (const c of cards)
    await lite.card.create({ data: { ...c, rects: j(c.rects), tags: j(c.tags) } });
  for (const s of sheets) await lite.traverseSheet.create({ data: s });
  for (const r of rows)
    await lite.traverseRow.create({ data: { ...r, linkedCardIds: j(r.linkedCardIds) } });
  for (const a of artefacts) await lite.generatedArtefact.create({ data: a });
  for (const x of annexures) await lite.annexureItem.create({ data: x });
  for (const t of tokens) await lite.apiToken.create({ data: t });
  for (const e of chrono) await lite.chronologyEntry.create({ data: e });

  const check = await lite.card.count();
  console.log(`into SQLite: ${check} cards — MIGRATION COMPLETE`);
} finally {
  await pg.$disconnect();
  await lite.$disconnect();
}
