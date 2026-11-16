import { Database } from "bun:sqlite";
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export function openStore(path, key, maxBytes = 268435456) {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1048576)
		throw new Error("Invalid database quota");
	if (!Buffer.isBuffer(key) || key.length !== 32)
		throw new Error("A 32-byte encryption key is required");
	const db = new Database(path, { create: true });
	db.exec(
		"PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
	);
	db.exec(`CREATE TABLE IF NOT EXISTS destinations(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,secret TEXT NOT NULL);
	CREATE TABLE IF NOT EXISTS routes(id TEXT PRIMARY KEY,name TEXT NOT NULL,destinations TEXT NOT NULL);
	CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,name TEXT NOT NULL,route TEXT NOT NULL REFERENCES routes(id),hash TEXT NOT NULL);
	CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,source TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,idem TEXT, UNIQUE(source,idem));
	CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,notification TEXT NOT NULL REFERENCES notifications(id),destination TEXT NOT NULL REFERENCES destinations(id),state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,due INTEGER NOT NULL DEFAULT 0,error TEXT);
	`);
	db.exec(
		"CREATE TABLE IF NOT EXISTS source_status(source TEXT PRIMARY KEY REFERENCES sources(id),revoked INTEGER NOT NULL DEFAULT 0)",
	);
	if (
		!db
			.query("PRAGMA table_info(notifications)")
			.all()
			.some((c) => c.name === "route")
	)
		db.exec("ALTER TABLE notifications ADD COLUMN route TEXT");
	db.exec(
		"PRAGMA max_page_count=" +
			Math.floor(maxBytes / db.query("PRAGMA page_size").get().page_size),
	);
	const seal = (value) => {
		const iv = randomBytes(12),
			cipher = createCipheriv("aes-256-gcm", key, iv);
		const ct = Buffer.concat([
			cipher.update(JSON.stringify(value)),
			cipher.final(),
		]);
		return [iv, cipher.getAuthTag(), ct]
			.map((b) => b.toString("base64"))
			.join(".");
	};
	const unseal = (text) => {
		const [iv, tag, ct] = text.split(".").map((s) => Buffer.from(s, "base64"));
		const cipher = createDecipheriv("aes-256-gcm", key, iv);
		cipher.setAuthTag(tag);
		return JSON.parse(
			Buffer.concat([cipher.update(ct), cipher.final()]).toString(),
		);
	};
	return { db, seal, unseal };
}
export function accept(store, source, body, idem) {
	return store.db
		.transaction(() => {
			const db = store.db;
			if (idem) {
				const existing = db
					.query("SELECT * FROM notifications WHERE source=? AND idem=?")
					.get(source.id, idem);
				if (existing) {
					if (existing.body !== JSON.stringify(body))
						throw Object.assign(new Error("Idempotency key conflict"), {
							status: 409,
						});
					return existing.id;
				}
			}
			if (
				db.query("SELECT count(*) AS n FROM jobs WHERE state='pending'").get()
					.n >= 10000
			)
				throw Object.assign(new Error("Queue full"), { status: 503 });
			const route = db
				.query("SELECT * FROM routes WHERE id=?")
				.get(source.route);
			const targets = JSON.parse(route.destinations);
			if (
				targets.length +
					db.query("SELECT count(*) n FROM jobs WHERE state='pending'").get()
						.n >
					10000 ||
				db.query("SELECT count(*) n FROM jobs").get().n + targets.length >
					100000
			)
				throw Object.assign(new Error("Queue quota reached"), { status: 503 });
			if (!targets.length) throw new Error("Route has no destinations");
			const id = crypto.randomUUID();
			db.query(
				"INSERT INTO notifications(id,source,body,created,idem,route) VALUES(?,?,?,?,?,?)",
			).run(
				id,
				source.id,
				JSON.stringify(body),
				Date.now(),
				idem || null,
				source.route,
			);
			for (const target of new Set(targets))
				db.query(
					"INSERT INTO jobs(id,notification,destination) VALUES(?,?,?)",
				).run(crypto.randomUUID(), id, target);
			return id;
		})
		.immediate();
}
