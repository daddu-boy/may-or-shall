// May or Shall — desktop shell.
// Runs the Next.js standalone server in-process (SQLite + PDF storage in the
// OS app-data folder) and opens the app in a window. No terminal, no Docker,
// no database server: double-click and it works. The Chrome extension and
// Word add-in connect to the same server at http://localhost:<port>.
const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");

const PREFERRED_PORT = 3000;

/** Directory holding the Next standalone build (packaged vs dev checkout). */
function serverRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", ".next", "standalone");
}

function firstFreePort(preferred) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => {
      // preferred port taken (e.g. a dev server) — let the OS pick one
      const alt = net.createServer();
      alt.listen(0, "127.0.0.1", () => {
        const port = alt.address().port;
        alt.close(() => resolve(port));
      });
    });
    srv.listen(preferred, "127.0.0.1", () => {
      srv.close(() => resolve(preferred));
    });
  });
}

/** Apply bundled migrations to the SQLite file (mimics `prisma migrate deploy`). */
async function ensureDatabase(root, dataDir) {
  const { PrismaClient } = require(path.join(root, "node_modules", "@prisma/client"));
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Matter'"
    );
    if (tables.length === 0) {
      const migrationsDir = app.isPackaged
        ? path.join(process.resourcesPath, "migrations")
        : path.join(__dirname, "..", "prisma", "migrations");
      const dirs = fs
        .readdirSync(migrationsDir)
        .filter((d) => fs.existsSync(path.join(migrationsDir, d, "migration.sql")))
        .sort();
      for (const dir of dirs) {
        const sql = fs.readFileSync(path.join(migrationsDir, dir, "migration.sql"), "utf-8");
        for (const stmt of sql.split(/;\s*[\r\n]/).map((s) => s.trim()).filter(Boolean)) {
          await prisma.$executeRawUnsafe(stmt);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function start() {
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(path.join(dataDir, "storage"), { recursive: true });

  const port = await firstFreePort(PREFERRED_PORT);
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.DATABASE_URL = `file:${path.join(dataDir, "mayorshall.db")}`;
  process.env.STORAGE_DIR = path.join(dataDir, "storage");
  // users can drop their own AI prompt templates here (see README)
  process.env.PROMPTS_DIR = path.join(dataDir, "prompts");
  fs.mkdirSync(process.env.PROMPTS_DIR, { recursive: true });
  process.env.NODE_ENV = "production";

  const root = serverRoot();
  try {
    await ensureDatabase(root, dataDir);
    // starting the standalone server begins listening as a side effect
    process.chdir(root);
    require(path.join(root, "server.js"));
  } catch (e) {
    dialog.showErrorBox("May or Shall could not start", String(e && e.stack ? e.stack : e));
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "May or Shall",
    webPreferences: { contextIsolation: true },
  });
  // external links (sources, GitHub) open in the user's real browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const url = `http://127.0.0.1:${port}`;
  // the server needs a moment on first boot; retry until it answers
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${url}/api/matters`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await win.loadURL(url);
}

app.whenReady().then(start);
app.on("window-all-closed", () => app.quit());
