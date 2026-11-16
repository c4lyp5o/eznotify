import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { send } from "../backend/delivery.js";
import { accept, hash, openStore } from "../backend/store.js";

test("acknowledged jobs survive database reopen", () => {
	const dir = mkdtempSync(join(tmpdir(), "eznotify-test-")),
		path = join(dir, "db.sqlite"),
		key = Buffer.alloc(32, 3);
	try {
		let s = openStore(path, key);
		s.db
			.query("INSERT INTO destinations VALUES('d','demo','ntfy',?)")
			.run(s.seal({ url: "https://example.com" }));
		s.db.query("INSERT INTO routes VALUES('r','ops','[\"d\"]')").run();
		s.db
			.query("INSERT INTO sources VALUES('s','job','r',?)")
			.run(hash("example"));
		const id = accept(s, { id: "s", route: "r" }, { body: "persist" });
		s.db.close();
		s = openStore(path, key);
		expect(s.db.query("SELECT notification FROM jobs").get().notification).toBe(
			id,
		);
		expect(
			s.unseal(s.db.query("SELECT secret FROM destinations").get().secret).url,
		).toBe("https://example.com");
		s.db.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
test("oversized messages fail explicitly rather than silently truncate", async () => {
	let calls = 0;
	await expect(
		send(
			{ kind: "discord", config: { url: "https://example.com" } },
			{ body: "x".repeat(2000) },
			async () => {
				calls++;
				return new Response();
			},
		),
	).rejects.toThrow("limit");
	expect(calls).toBe(0);
});
