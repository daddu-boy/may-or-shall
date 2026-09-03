import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DB } } });
const u = await prisma.user.findUnique({ where: { email: "reviewer@mayorshall.com" }, select: { id: true, createdAt: true } });
if (!u) { console.log("NO REVIEWER ACCOUNT"); process.exit(0); }
const matters = await prisma.matter.findMany({
  where: { userId: u.id },
  select: { id: true, title: true, kind: true, createdAt: true,
            _count: { select: { documents: true, cards: true } } },
  orderBy: { createdAt: "asc" },
});
console.log("reviewer account created:", u.createdAt.toISOString().slice(0, 16));
for (const m of matters) {
  console.log(` matter "${m.title}" [${m.kind}] docs=${m._count.documents} cards=${m._count.cards} created=${m.createdAt.toISOString().slice(0,16)}`);
}
const byOrigin = await prisma.card.groupBy({
  by: ["createdBy"], where: { matter: { userId: u.id } }, _count: { id: true },
});
console.log("cards by origin:", JSON.stringify(byOrigin.map((b) => [b.createdBy, b._count.id])));
await prisma.$disconnect();
