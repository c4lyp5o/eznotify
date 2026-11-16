import { expect, test } from "bun:test";
import { createApp } from "../backend/app.js";
import { createWorker } from "../backend/delivery.js";
import { accept, hash, openStore } from "../backend/store.js";

test("HTTP snapshot attribution survives source reassignment; terminal failure retry never resends success", async () => {
	const s = openStore(":memory:", Buffer.alloc(32, 4));
	for (const id of ["a", "b"])
		s.db
			.query("INSERT INTO destinations VALUES(?,?,?,?)")
			.run(id, id, "ntfy", s.seal({ url: "https://example.com", topic: id }));
	for (const id of ["r", "other"])
		s.db.query("INSERT INTO routes VALUES(?,?,?)").run(id, id, '["a","b"]');
	s.db
		.query("INSERT INTO sources VALUES('s','source','r',?)")
		.run(hash("fixture"));
	const id = accept(
		s,
		{ id: "s", route: "r" },
		{ body: "acceptance" },
		"dedup",
	);
	expect(
		accept(s, { id: "s", route: "r" }, { body: "acceptance" }, "dedup"),
	).toBe(id);
	s.db.query("UPDATE sources SET route='other' WHERE id='s'").run();
	let fail = true;
	const calls = { a: 0, b: 0 };
	const tick = createWorker(s, async (_url, init) => {
		const topic = JSON.parse(init.body).topic;
		calls[topic]++;
		return new Response("", { status: topic === "b" && fail ? 400 : 200 });
	});
	const token = crypto.randomUUID();
	const app = createApp(s, token).listen({ hostname: "127.0.0.1", port: 0 });
	const base = "http://127.0.0.1:" + app.server.port;
	try {
		await tick();
		const headers = { Authorization: "Bearer " + token };
		expect((await fetch(base + "/api/state")).status).toBe(401);
		const state = await (await fetch(base + "/api/state", { headers })).json();
		expect(state.jobs.every((j) => j.route === "r" && j.source === "s")).toBe(
			true,
		);
		expect(state.jobs.map((j) => j.state).sort()).toEqual([
			"delivered",
			"failed",
		]);
		fail = false;
		const job = state.jobs.find((j) => j.state === "failed");
		expect(
			(
				await fetch(base + "/api/jobs/" + job.id + "/retry", {
					method: "POST",
					headers,
				})
			).status,
		).toBe(200);
		await tick();
		expect(calls).toEqual({ a: 1, b: 2 });
		expect(
			s.db.query("SELECT count(*) n FROM jobs WHERE state='delivered'").get().n,
		).toBe(2);
	} finally {
		app.stop();
		s.db.close();
	}
});
