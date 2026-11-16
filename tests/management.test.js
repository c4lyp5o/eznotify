import { expect, test } from "bun:test";
import { createApp } from "../backend/app.js";
import { accept, hash, openStore } from "../backend/store.js";

test("authenticated management, rotation, snapshots, targeted retry and non-sending discovery", async () => {
	const s = openStore(":memory:", Buffer.alloc(32, 1)),
		token = "management-test-admin-long-enough";
	let calls = [];
	let webhook = false;
	const transport = async (url) => {
		calls.push(url);
		return Response.json({
			ok: true,
			result: url.endsWith("getMe")
				? { username: "testbot" }
				: url.endsWith("getWebhookInfo")
					? { url: webhook ? "https://existing.example" : "" }
					: [
							{ message: { chat: { id: 123, first_name: "Test" } } },
							{ message: { chat: { id: 123, first_name: "Test" } } },
						],
		});
	};
	const app = createApp(s, token, transport).listen({
		hostname: "127.0.0.1",
		port: 0,
	});
	const base = "http://127.0.0.1:" + app.server.port;
	const post = (p, b = {}, auth = true) =>
		fetch(base + "/api" + p, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(auth ? { Authorization: "Bearer " + token } : {}),
			},
			body: JSON.stringify(b),
		});
	try {
		for (const p of [
			"/sources/s/rotate",
			"/sources/s/revoke",
			"/routes/r/update",
			"/destinations/d/update",
			"/jobs/j/retry",
			"/onboarding/validate",
			"/onboarding/telegram/chats",
		])
			expect((await post(p, {}, false)).status).toBe(401);
		for (const id of ["a", "b"])
			s.db
				.query("INSERT INTO destinations VALUES(?,?,?,?)")
				.run(id, id, "ntfy", s.seal({ url: "https://example.com", topic: id }));
		s.db.query("INSERT INTO routes VALUES('r','ops','[\"a\"]')").run();
		s.db.query("INSERT INTO sources VALUES('s','job','r',?)").run(hash("old"));
		const first = accept(s, { id: "s", route: "r" }, { body: "old route" });
		expect(
			(await post("/routes/r/update", { name: "changed", destinations: ["b"] }))
				.status,
		).toBe(200);
		expect(
			s.db.query("SELECT destination FROM jobs WHERE notification=?").get(first)
				.destination,
		).toBe("a");
		const second = accept(s, { id: "s", route: "r" }, { body: "new route" });
		expect(
			s.db
				.query("SELECT destination FROM jobs WHERE notification=?")
				.get(second).destination,
		).toBe("b");
		expect(
			(
				await post("/routes/r/update", {
					name: "bad",
					destinations: ["missing"],
				})
			).status,
		).toBe(404);

		const beforeSecret = s.db
			.query("SELECT secret FROM destinations WHERE id='a'")
			.get().secret;
		expect(
			(await post("/destinations/a/rename", { name: " Renamed " })).status,
		).toBe(200);
		expect(
			s.db.query("SELECT name,secret FROM destinations WHERE id='a'").get(),
		).toEqual({ name: "Renamed", secret: beforeSecret });
		expect((await post("/destinations/a/rename", { name: " " })).status).toBe(
			400,
		);
		s.db.query("INSERT INTO routes VALUES('r2','second','[\"b\"]')").run();
		expect(
			(await post("/sources/s/update", { name: "new source", route: "r2" }))
				.status,
		).toBe(200);
		expect(
			s.db.query("SELECT route,hash FROM sources WHERE id='s'").get(),
		).toEqual({ route: "r2", hash: hash("old") });
		expect(
			(await post("/sources/s/update", { name: "bad", route: "missing" }))
				.status,
		).toBe(404);
		expect(
			(await post("/sources/s/update", { name: 123, route: "r" })).status,
		).toBe(400);
		for (const p of ["/sources/s/update", "/destinations/a/rename"])
			expect((await post(p, {}, false)).status).toBe(401);
		const rotated = await (await post("/sources/s/rotate")).json();
		expect(rotated.token).toBeTruthy();
		expect(s.db.query("SELECT hash FROM sources").get().hash).toBe(
			hash(rotated.token),
		);
		const publish = (secret) =>
			fetch(base + "/v1/notify", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + secret,
				},
				body: JSON.stringify({ body: "test" }),
			});
		expect((await publish("old")).status).toBe(401);
		expect((await publish(rotated.token)).status).toBe(202);
		await post("/sources/s/revoke");
		expect(
			s.db.query("SELECT revoked FROM source_status WHERE source='s'").get()
				.revoked,
		).toBe(1);
		const state = await (
			await fetch(base + "/api/state", {
				headers: { Authorization: "Bearer " + token },
			})
		).json();
		expect(state.sources[0].revoked).toBe(1);
		expect((await publish(rotated.token)).status).toBe(401);
		const job = s.db.query("SELECT id FROM jobs LIMIT 1").get();
		expect((await post("/jobs/" + job.id + "/retry")).status).toBe(409);
		s.db.query("UPDATE jobs SET state='failed' WHERE id=?").run(job.id);
		expect((await post("/jobs/" + job.id + "/retry")).status).toBe(200);
		s.db.query("UPDATE jobs SET state='delivered' WHERE id=?").run(job.id);
		expect((await post("/jobs/" + job.id + "/retry")).status).toBe(409);
		expect(
			(
				await post("/destinations/a/update", {
					name: "new",
					kind: "ntfy",
					config: { url: "https://new.example", topic: "private" },
				})
			).status,
		).toBe(200);
		expect(
			s.unseal(
				s.db.query("SELECT secret FROM destinations WHERE id='a'").get().secret,
			).topic,
		).toBe("private");
		const val = await (
			await post("/onboarding/validate", {
				kind: "telegram",
				config: { token: "123:abc", chatId: "123" },
			})
		).json();
		expect(val.level).toBe("credentials");
		const chats = await (
			await post("/onboarding/telegram/chats", { token: "123:abc" })
		).json();
		expect(chats.chats).toHaveLength(1);
		webhook = true;
		expect(
			(await post("/onboarding/telegram/chats", { token: "123:abc" })).status,
		).toBe(409);
		expect(
			calls.some(
				(u) =>
					u.includes("sendMessage") ||
					u.includes("deleteWebhook") ||
					u.includes("offset="),
			),
		).toBe(false);
	} finally {
		await app.stop();
		s.db.close();
	}
});
