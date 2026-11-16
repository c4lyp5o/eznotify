export function prune(store, now = Date.now(), days = 30) {
	const cutoff = now - days * 86400000;
	store.db
		.transaction(() => {
			// Preserve pending work and the complete fanout until all branches are terminal.
			store.db
				.query(
					"DELETE FROM jobs WHERE notification IN (SELECT id FROM notifications WHERE created < ? AND NOT EXISTS (SELECT 1 FROM jobs WHERE notification=notifications.id AND state='pending'))",
				)
				.run(cutoff);
			store.db
				.query(
					"DELETE FROM notifications WHERE created < ? AND NOT EXISTS (SELECT 1 FROM jobs WHERE notification=notifications.id)",
				)
				.run(cutoff);
		})
		.immediate();
	store.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
}
