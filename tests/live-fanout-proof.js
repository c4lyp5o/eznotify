// Manual only: publishes two harmless messages to unique ntfy topics.
import { createApp } from "../backend/app.js";
import { createWorker } from "../backend/delivery.js";
import { openStore } from "../backend/store.js";

const store = openStore(
	":memory:",
	Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
);
const token = crypto.randomUUID();
const app = createApp(store, token).listen({ hostname: "127.0.0.1", port: 0 });
const base = "http://127.0.0.1:" + app.server.port;
const host = "https://ntfy.calypsocloud.one";
const marker = "eznotify acceptance " + crypto.randomUUID();
async function post(path, body) {
	const r = await fetch(base + "/api" + path, {
		method: "POST",
		headers: {
			Authorization: "Bearer " + token,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!r.ok) throw new Error("Admin request failed: " + r.status);
	return r.json();
}
try {
	const topics = [crypto.randomUUID(), crypto.randomUUID()].map(
		(x) => "eznotify-proof-" + x,
	);
	const destinations = [];
	for (const topic of topics)
		destinations.push(
			(
				await post("/destinations", {
					name: "Acceptance",
					kind: "ntfy",
					config: { url: host, topic },
				})
			).id,
		);
	const route = await post("/routes", { name: "Acceptance", destinations });
	const source = await post("/sources", {
		name: "Acceptance",
		route: route.id,
	});
	for (let i = 0; i < 2; i++) {
		const r = await fetch(base + "/v1/notify", {
			method: "POST",
			headers: {
				Authorization: "Bearer " + source.token,
				"Content-Type": "application/json",
				"Idempotency-Key": marker,
			},
			body: JSON.stringify({ body: marker }),
		});
		if (!r.ok) throw new Error("Intake failed: " + r.status);
	}
	await createWorker(store)();
	const jobs = store.db.query("SELECT state FROM jobs").all();
	if (jobs.length !== 2 || jobs.some((j) => j.state !== "delivered"))
		throw new Error("Delivery failed");
	for (const topic of topics) {
		const r = await fetch(host + "/" + topic + "/json?poll=1", {
			signal: AbortSignal.timeout(10000),
		});
		if (!r.ok || !(await r.text()).includes(marker))
			throw new Error("Readback failed");
	}
	console.log(
		"PASS: real HTTP intake; two real ntfy destinations delivered; both server-side readbacks found; duplicate intake created no extra jobs. Device receipt not asserted.",
	);
} finally {
	app.stop();
	store.db.close();
}
