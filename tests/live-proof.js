import { unlinkSync } from "node:fs";
import { createApp } from "../backend/app.js";
import { createWorker } from "../backend/delivery.js";
import { openStore } from "../backend/store.js";

const credentialPath =
	"/home/calypso/.hermes/cache/scratch/eznotify-live-credentials.json";
const config = await Bun.file(credentialPath).json();
unlinkSync(credentialPath);
const store = openStore(
	":memory:",
	Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
);
const admin = crypto.randomUUID() + crypto.randomUUID();
const app = createApp(store, admin).listen({ hostname: "127.0.0.1", port: 0 });
const base = "http://127.0.0.1:" + app.server.port;
const topic = "eznotify-proof-" + crypto.randomUUID();
const marker = "eznotify E2E " + new Date().toISOString();
async function post(path, body) {
	const r = await fetch(base + "/api" + path, {
		method: "POST",
		headers: {
			Authorization: "Bearer " + admin,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!r.ok) throw new Error("Local admin HTTP " + r.status);
	return r.json();
}
try {
	const a = await post("/destinations", {
		name: "Telegram live proof",
		kind: "telegram",
		config,
	});
	const b = await post("/destinations", {
		name: "ntfy live proof",
		kind: "ntfy",
		config: { url: "https://ntfy.calypsocloud.one", topic },
	});
	const route = await post("/routes", {
		name: "Live fanout",
		destinations: [a.id, b.id],
	});
	const source = await post("/sources", {
		name: "HTTP integration proof",
		route: route.id,
	});
	const publish = () =>
		fetch(base + "/api/webhooks/" + source.id + "/" + source.token, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Idempotency-Key": marker,
			},
			body: JSON.stringify({
				content:
					marker +
					" — one source request, Telegram + ntfy. Harmless integration test.",
			}),
		});
	const response = await publish();
	if (response.status !== 204)
		throw new Error("Intake HTTP " + response.status);
	await createWorker(store)();
	const jobs = store.db
		.query("SELECT destination,state,attempts,error FROM jobs")
		.all();
	const duplicate = await publish();
	const cached = await fetch(
		"https://ntfy.calypsocloud.one/" + topic + "/json?poll=1",
		{ signal: AbortSignal.timeout(10000) },
	);
	const found = cached.ok && (await cached.text()).includes(marker);
	const result = {
		marker,
		intakeStatus: response.status,
		duplicateStatus: duplicate.status,
		jobCount: store.db.query("SELECT count(*) n FROM jobs").get().n,
		telegram: jobs.find((j) => j.destination === a.id),
		ntfy: jobs.find((j) => j.destination === b.id),
		ntfyReadback: found,
	};
	delete result.telegram.destination;
	delete result.ntfy.destination;
	console.log(JSON.stringify(result));
	if (
		jobs.some((j) => j.state !== "delivered") ||
		!found ||
		result.jobCount !== 2
	)
		process.exitCode = 1;
} catch {
	console.log(
		"Live proof blocked: check provider connectivity/acceptance; no credentials logged",
	);
	process.exitCode = 1;
} finally {
	await app.stop();
	store.db.close();
}
