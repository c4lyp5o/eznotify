import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Regression: the container runs as a non-root user from /app, so the server
// must create the database directory from EZNOTIFY_DB, not from a hardcoded
// relative "data/" path.
test("server creates the configured database directory and starts", async () => {
	const root = mkdtempSync(join(tmpdir(), "eznotify-start-"));
	const db = join(root, "nested", "volume", "eznotify.sqlite");
	const port = 20000 + Math.floor(Math.random() * 20000);
	const proc = Bun.spawn([process.execPath, "backend/server.js"], {
		cwd: join(import.meta.dir, ".."),
		env: {
			...process.env,
			EZNOTIFY_ADMIN_TOKEN: "test-only-admin-token-long-enough",
			EZNOTIFY_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
			EZNOTIFY_DB: db,
			HOST: "127.0.0.1",
			PORT: String(port),
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	try {
		let health = null;
		for (let i = 0; i < 50 && !health; i++) {
			await Bun.sleep(100);
			try {
				health = await fetch(`http://127.0.0.1:${port}/healthz`);
			} catch {}
		}
		expect(health?.status).toBe(200);
		expect(await Bun.file(db).exists()).toBe(true);
	} finally {
		proc.kill();
		await proc.exited;
		rmSync(root, { recursive: true, force: true });
	}
});
