import { expect, test } from "bun:test";
import { limitedText, outboundTransport } from "../backend/policy.js";
import { prune } from "../backend/retention.js";
import { accept, hash, openStore } from "../backend/store.js";

test("outbound origin policy fails closed, prevents suffix confusion and redirects", async () => {
	let calls = 0;
	const transport = outboundTransport(
		"https://notify.example",
		async (_url, options) => {
			calls++;
			expect(options.redirect).toBe("error");
			return new Response("");
		},
	);
	for (const url of [
		"http://notify.example",
		"https://notify.example.evil",
		"http://127.0.0.1",
		"https://169.254.169.254",
		"https://u:p@notify.example",
	])
		expect(() => transport(url)).toThrow();
	await transport("https://notify.example/message", { redirect: "follow" });
	expect(calls).toBe(1);
	expect(() => outboundTransport("http://localhost")).toThrow();
});
test("streaming limit refuses oversized chunked payloads", async () => {
	const request = new Request("http://localhost", {
		method: "POST",
		body: new ReadableStream({
			start(c) {
				c.enqueue(new Uint8Array(100));
				c.enqueue(new Uint8Array(100));
				c.close();
			},
		}),
		duplex: "half",
	});
	await expect(limitedText(request, 150)).rejects.toThrow("Body too large");
	expect(
		await limitedText(
			new Request("http://localhost", { method: "POST", body: "hello" }),
		),
	).toBe("hello");
});
test("retention preserves mixed pending fanout and prunes old terminal data", () => {
	const s = openStore(":memory:", Buffer.alloc(32, 9));
	try {
		s.db
			.query("INSERT INTO destinations VALUES('d','d','ntfy','unused')")
			.run();
		s.db.query("INSERT INTO routes VALUES('r','r','[\"d\"]')").run();
		s.db
			.query("INSERT INTO sources VALUES('s','s','r',?)")
			.run(hash("fixture"));
		const old = accept(s, { id: "s", route: "r" }, { body: "old" }, "old");
		const pending = accept(
			s,
			{ id: "s", route: "r" },
			{ body: "pending" },
			"pending",
		);
		s.db.query("UPDATE notifications SET created=1").run();
		s.db
			.query("UPDATE jobs SET state='delivered' WHERE notification=?")
			.run(old);
		prune(s);
		expect(s.db.query("SELECT id FROM notifications").all()).toEqual([
			{ id: pending },
		]);
		expect(s.db.query("PRAGMA max_page_count").get().max_page_count).toBe(
			65536,
		);
	} finally {
		s.db.close();
	}
});
