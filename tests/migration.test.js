import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import { openStore } from "../backend/store.js";

test("legacy notifications retain null attribution across idempotent migration", () => {
	const path =
		(process.env.TMPDIR || "/home/calypso/.hermes/cache/scratch") +
		"/eznotify-migration-" +
		crypto.randomUUID() +
		".sqlite";
	let store;
	try {
		const db = new Database(path);
		db.exec(
			"CREATE TABLE notifications(id TEXT PRIMARY KEY,source TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,idem TEXT,UNIQUE(source,idem)); INSERT INTO notifications VALUES('legacy','s','{}',1,NULL)",
		);
		db.close();
		store = openStore(path, Buffer.alloc(32, 6));
		expect(
			store.db.query("SELECT route FROM notifications WHERE id='legacy'").get()
				.route,
		).toBeNull();
		store.db.close();
		store = openStore(path, Buffer.alloc(32, 6));
		expect(store.db.query("SELECT count(*) n FROM notifications").get().n).toBe(
			1,
		);
		expect(
			store.db
				.query("PRAGMA table_info(notifications)")
				.all()
				.filter((c) => c.name === "route").length,
		).toBe(1);
	} finally {
		store?.db.close();
		for (const suffix of ["", "-wal", "-shm"]) {
			try {
				unlinkSync(path + suffix);
			} catch {}
		}
	}
});
