import { unlinkSync } from "node:fs";
import { createApp } from "../backend/app.js";
import { createWorker } from "../backend/delivery.js";
import { openStore } from "../backend/store.js";

const credentialPath =
	"/home/calypso/.hermes/cache/scratch/eznotify-discord-proof.json";
const config = await Bun.file(credentialPath).json();
unlinkSync(credentialPath);
const store = openStore(
	":memory:",
	Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
);
const admin = crypto.randomUUID() + crypto.randomUUID();
const app = createApp(store, admin).listen({ hostname: "127.0.0.1", port: 0 });
const base = "http://127.0.0.1:" + app.server.port;
const marker = "eznotify Discord bot proof " + new Date().toISOString();
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
	const d = await post("/destinations", {
		name: "Discord bot proof",
		kind: "discord-bot",
		config,
	});
	const r = await post("/routes", {
		name: "Discord proof",
		destinations: [d.id],
	});
	const s = await post("/sources", {
		name: "Discord proof source",
		route: r.id,
	});
	const res = await fetch(base + "/api/webhooks/" + s.id + "/" + s.token, {
		method: "POST",
		headers: { "Content-Type": "application/json", "Idempotency-Key": marker },
		body: JSON.stringify({
			content: marker + ". Harmless test; mentions disabled.",
		}),
	});
	if (res.status !== 204) throw new Error("Intake HTTP " + res.status);
	await createWorker(store)();
	const job = store.db.query("SELECT state,attempts,error FROM jobs").get();
	console.log(JSON.stringify({ marker, job }));
	if (job?.state !== "delivered") process.exitCode = 1;
} catch (e) {
	console.log("Discord proof blocked: " + e.message);
	process.exitCode = 1;
} finally {
	await app.stop();
	store.db.close();
}
