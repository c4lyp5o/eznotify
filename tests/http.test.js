import { expect, test } from "bun:test";
import { createApp } from "../backend/app.js";
import { openStore } from "../backend/store.js";

test("real HTTP admin isolation, configuration and five intake contracts", async () => {
	const s = openStore(":memory:", Buffer.alloc(32, 2)),
		token = "test-only-admin-token-long-enough";
	const app = createApp(s, token, async () => new Response("{}"));
	app.listen({ hostname: "127.0.0.1", port: 0 });
	const base = "http://127.0.0.1:" + app.server.port;
	const admin = async (path, body) =>
		fetch(base + "/api" + path, {
			method: body ? "POST" : "GET",
			headers: {
				Authorization: "Bearer " + token,
				"Content-Type": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
		});
	try {
		expect((await fetch(base + "/api/state")).status).toBe(401);
		expect(
			(
				await fetch(base + "/api/sources", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: "{}",
				})
			).status,
		).toBe(401);
		const d = await (
			await admin("/destinations", {
				name: "Test",
				kind: "ntfy",
				config: { url: "https://example.com", topic: "test" },
			})
		).json();
		expect(d.id).toBeTruthy();
		const route = await (
			await admin("/routes", { name: "ops", destinations: [d.id] })
		).json();
		const source = await (
			await admin("/sources", { name: "job", route: route.id })
		).json();
		expect(source.token).toBeTruthy();
		const state = await (await admin("/state")).text();
		expect(state).not.toContain(source.token);
		expect(state).not.toContain("https://example.com");
		for (const [path, body, status, headers] of [
			[
				"/api/webhooks/" + source.id + "/" + source.token,
				{ content: "Discord" },
				204,
				{},
			],
			[
				"/services/" + source.id + "/notify/" + source.token,
				{ text: "Slack" },
				200,
				{},
			],
			[
				"/gotify/message",
				{ message: "Gotify" },
				200,
				{ "X-Gotify-Key": source.token },
			],
			[
				"/ntfy/" + source.id,
				{ message: "ntfy" },
				200,
				{ Authorization: "Bearer " + source.token },
			],
			[
				"/1/messages.json",
				{ token: source.token, user: source.id, message: "Pushover" },
				200,
				{},
			],
			[
				"/v1/notify",
				{ body: "Native" },
				202,
				{ Authorization: "Bearer " + source.token },
			],
		]) {
			const r = await fetch(base + path, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...headers },
				body: JSON.stringify(body),
			});
			expect(r.status).toBe(status);
		}
		expect(s.db.query("SELECT count(*) n FROM jobs").get().n).toBe(6);
		expect(
			(
				await fetch(base + "/api/webhooks/" + source.id + "/wrong", {
					method: "POST",
					body: "{}",
				})
			).status,
		).toBe(401);
		const index = await fetch(base + "/");
		expect(index.status).toBe(200);
		expect(await index.text()).toContain('id="root"');
	} finally {
		await app.stop();
		s.db.close();
	}
});
