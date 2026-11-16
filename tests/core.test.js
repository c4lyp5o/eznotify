import { expect, test } from "bun:test";
import { createWorker, validateDestination } from "../backend/delivery.js";
import { normalize } from "../backend/intake.js";
import { accept, hash, openStore } from "../backend/store.js";

function fixture() {
	const s = openStore(":memory:", Buffer.alloc(32, 1));
	for (const id of ["a", "b"])
		s.db
			.query("INSERT INTO destinations VALUES(?,?,?,?)")
			.run(
				id,
				id,
				"ntfy",
				s.seal({ url: "https://notify.example", topic: id }),
			);
	s.db.query("INSERT INTO routes VALUES('r','ops','[\"a\",\"b\"]')").run();
	s.db
		.query("INSERT INTO sources VALUES('s','backup','r',?)")
		.run(hash("test"));
	return s;
}
test("five intake shapes preserve readable text", () => {
	for (const [kind, body] of [
		["discord", { content: "hello" }],
		["slack", { text: "hello" }],
		["ntfy", "hello"],
		["gotify", { message: "hello" }],
		["pushover", { message: "hello" }],
	])
		expect(normalize(kind, body, new Headers()).body).toBe("hello");
});
test("unsupported emergency and empty payloads rejected", () => {
	expect(() => normalize("pushover", { message: "x", priority: 2 })).toThrow();
	expect(() => normalize("discord", {})).toThrow();
});
test("atomic fanout, source scoped deduplication and conflict", () => {
	const s = fixture(),
		source = { id: "s", route: "r" };
	const id = accept(s, source, { title: "", body: "hello" }, "key");
	expect(accept(s, source, { title: "", body: "hello" }, "key")).toBe(id);
	expect(s.db.query("SELECT count(*) n FROM jobs").get().n).toBe(2);
	expect(() => accept(s, source, { body: "different" }, "key")).toThrow();
	expect(s.db.query("SELECT count(*) n FROM notifications").get().n).toBe(1);
	s.db.close();
});
test("encryption and independent retries do not resend successes", async () => {
	const s = fixture();
	accept(s, { id: "s", route: "r" }, { body: "hello" });
	let calls = 0;
	const worker = createWorker(s, async (url, init) => {
		calls++;
		return new Response("", {
			status: JSON.parse(init.body).topic === "b" ? 503 : 200,
		});
	});
	await worker();
	expect(
		s.db.query("SELECT count(*) n FROM jobs WHERE state='delivered'").get().n,
	).toBe(1);
	s.db.query("UPDATE jobs SET due=0").run();
	await worker();
	expect(calls).toBe(3);
	const ciphertext = s.db
		.query("SELECT secret FROM destinations LIMIT 1")
		.get().secret;
	expect(ciphertext).not.toContain("notify.example");
	expect(() => openStore(":memory:", Buffer.alloc(1))).toThrow();
	s.db.close();
});
test("destination validation rejects arbitrary protocols and malformed bots", () => {
	expect(() =>
		validateDestination("ntfy", { url: "file:///etc/passwd" }),
	).toThrow();
	expect(() => validateDestination("telegram", { token: "bad" })).toThrow();
});
