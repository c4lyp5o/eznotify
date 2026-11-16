import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./app.js";
import { createWorker } from "./delivery.js";
import { outboundTransport } from "./policy.js";
import { prune } from "./retention.js";
import { openStore } from "./store.js";

if (!process.env.EZNOTIFY_ADMIN_TOKEN || !process.env.EZNOTIFY_ENCRYPTION_KEY)
	throw new Error("Set EZNOTIFY_ADMIN_TOKEN and EZNOTIFY_ENCRYPTION_KEY");
process.umask(0o077);
const dbPath = process.env.EZNOTIFY_DB || "data/eznotify.sqlite";
const dbDir = dirname(dbPath);
mkdirSync(dbDir, { recursive: true, mode: 0o700 });
chmodSync(dbDir, 0o700);
const store = openStore(
	dbPath,
	Buffer.from(process.env.EZNOTIFY_ENCRYPTION_KEY, "base64"),
);
const transport = outboundTransport(
	process.env.EZNOTIFY_OUTBOUND_ORIGINS || "",
);
prune(store);
const app = createApp(store, process.env.EZNOTIFY_ADMIN_TOKEN, transport);
app.listen({
	hostname: process.env.HOST || "127.0.0.1",
	port: Number(process.env.PORT || 5099),
});
const tick = createWorker(store, transport);
let running = Promise.resolve();
let active = false;
const maintenance = setInterval(() => {
	try {
		prune(store);
	} catch {
		console.error("Retention failed");
	}
}, 3600000);
const timer = setInterval(() => {
	if (active) return;
	active = true;
	running = tick()
		.catch(() => console.error("Worker failed"))
		.finally(() => {
			active = false;
		});
}, 1000);
for (const signal of ["SIGTERM", "SIGINT"])
	process.on(signal, async () => {
		clearInterval(timer);
		clearInterval(maintenance);
		await app.stop();
		await running;
		store.db.close();
		process.exit(0);
	});
console.log(
	"eznotify listening on " +
		(process.env.HOST || "127.0.0.1") +
		":" +
		app.server.port,
);
