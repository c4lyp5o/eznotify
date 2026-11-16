import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { Elysia } from "elysia";
import { send, validateDestination } from "./delivery.js";
import { normalize } from "./intake.js";
import { management } from "./management.js";
import { onboarding } from "./onboarding.js";
import { limitedText } from "./policy.js";
import { accept, hash } from "./store.js";

const detail = (summary) => ({ detail: { summary, tags: ["eznotify"] } });
export function createApp(store, adminToken, transport = fetch) {
	if (!adminToken || adminToken.length < 24)
		throw new Error("Admin token must contain at least 24 characters");
	const db = store.db,
		counters = new Map();
	const authorized = (request) => {
		const got = hash(request.headers.get("authorization") || "");
		return timingSafeEqual(
			Buffer.from(got),
			Buffer.from(hash("Bearer " + adminToken)),
		);
	};
	const admin = new Elysia({ prefix: "/api" })
		.onBeforeHandle(({ request, set }) => {
			set.headers["Cache-Control"] = "no-store";
			if (!authorized(request)) {
				set.status = 401;
				return { message: "Unauthorized" };
			}
		})
		.get(
			"/state",
			() => ({
				destinations: db.query("SELECT id,name,kind FROM destinations").all(),
				routes: db
					.query("SELECT * FROM routes")
					.all()
					.map((r) => ({ ...r, destinations: JSON.parse(r.destinations) })),
				sources: db
					.query(
						"SELECT s.id,s.name,s.route,coalesce(st.revoked,0) AS revoked FROM sources s LEFT JOIN source_status st ON st.source=s.id",
					)
					.all(),
				jobs: db
					.query(
						"SELECT j.id,j.notification,j.destination,j.state,j.attempts,j.error,n.source,n.route,n.created FROM jobs j JOIN notifications n ON n.id=j.notification ORDER BY j.rowid DESC LIMIT 100",
					)
					.all(),
			}),
			detail("Read configuration and delivery history"),
		)
		.post(
			"/destinations",
			({ body, set }) => {
				validateDestination(body.kind, body.config);
				if (!body.name?.trim()) throw new Error("Name required");
				const id = crypto.randomUUID();
				db.query("INSERT INTO destinations VALUES(?,?,?,?)").run(
					id,
					body.name.slice(0, 100),
					body.kind,
					store.seal(body.config),
				);
				set.status = 201;
				return { id };
			},
			detail("Save an encrypted destination"),
		)
		.post(
			"/destinations/:id/test",
			async ({ params, set }) => {
				const d = db
					.query("SELECT * FROM destinations WHERE id=?")
					.get(params.id);
				if (!d) {
					set.status = 404;
					return { message: "Not found" };
				}
				try {
					await send(
						{ kind: d.kind, config: store.unseal(d.secret) },
						{
							title: "eznotify connection test",
							body: "Your notification destination is connected.",
						},
						transport,
					);
					return {
						message:
							"Test accepted by provider; confirm receipt on your device",
					};
				} catch {
					set.status = 502;
					return {
						message:
							"Test failed. Check credentials, permissions and server reachability.",
					};
				}
			},
			detail("Explicitly send a test notification"),
		)
		.post(
			"/routes",
			({ body, set }) => {
				if (
					!body.name?.trim() ||
					!Array.isArray(body.destinations) ||
					!body.destinations.length
				)
					throw new Error("Name and destinations required");
				const ids = [...new Set(body.destinations)];
				for (const id of ids)
					if (!db.query("SELECT id FROM destinations WHERE id=?").get(id))
						throw new Error("Unknown destination");
				const id = crypto.randomUUID();
				db.query("INSERT INTO routes VALUES(?,?,?)").run(
					id,
					body.name.slice(0, 100),
					JSON.stringify(ids),
				);
				set.status = 201;
				return { id };
			},
			detail("Create a fan-out route"),
		)
		.post(
			"/sources",
			({ body, set }) => {
				if (
					!body.name?.trim() ||
					!db.query("SELECT id FROM routes WHERE id=?").get(body.route)
				)
					throw new Error("Name and valid route required");
				const id = crypto.randomUUID(),
					token = randomBytes(32).toString("hex");
				db.query("INSERT INTO sources VALUES(?,?,?,?)").run(
					id,
					body.name.slice(0, 100),
					body.route,
					hash(token),
				);
				set.status = 201;
				return { id, token };
			},
			detail("Create source credentials (shown once)"),
		);
	management(admin, store);
	onboarding(admin, transport);
	async function intake(request, kind, sourceId, secret) {
		const source = sourceId
			? db.query("SELECT * FROM sources WHERE id=?").get(sourceId)
			: db.query("SELECT * FROM sources WHERE hash=?").get(hash(secret || ""));
		if (
			!source ||
			!secret ||
			!timingSafeEqual(Buffer.from(source.hash), Buffer.from(hash(secret)))
		)
			return Response.json({ message: "Unauthorized" }, { status: 401 });
		if (
			db
				.query("SELECT revoked FROM source_status WHERE source=?")
				.get(source.id)?.revoked
		)
			return Response.json({ message: "Unauthorized" }, { status: 401 });
		const now = Math.floor(Date.now() / 60000);
		const rate = counters.get(source.id);
		if (rate?.minute === now && rate.n >= 60)
			return Response.json(
				{ message: "Rate limited" },
				{ status: 429, headers: { "Retry-After": "60" } },
			);
		counters.set(source.id, {
			minute: now,
			n: rate?.minute === now ? rate.n + 1 : 1,
		});
		if (new URL(request.url).searchParams.get("wait") === "true")
			throw new Error("wait=true unsupported");
		const raw = await limitedText(request);
		if (Buffer.byteLength(raw) > 262144)
			return Response.json({ message: "Body too large" }, { status: 413 });
		const type = request.headers.get("content-type") || "";
		let body;
		if (kind === "ntfy" && !type.includes("json")) body = raw;
		else if (type.includes("application/x-www-form-urlencoded"))
			body = Object.fromEntries(new URLSearchParams(raw));
		else body = JSON.parse(raw);
		const normalized = normalize(kind, body, request.headers);
		const id = accept(
			store,
			source,
			normalized,
			request.headers.get("idempotency-key") || null,
		);
		if (kind === "discord") return new Response(null, { status: 204 });
		if (kind === "slack") return new Response("ok");
		if (kind === "ntfy")
			return {
				id,
				time: Math.floor(Date.now() / 1000),
				event: "message",
				topic: source.id,
				...normalized,
				message: normalized.body,
			};
		if (kind === "gotify")
			return {
				id: db.query("SELECT rowid FROM notifications WHERE id=?").get(id)
					.rowid,
				date: new Date().toISOString(),
				message: normalized.body,
				title: normalized.title,
				priority: 0,
			};
		if (kind === "pushover") return { status: 1, request: id };
		return Response.json({ id, status: "queued" }, { status: 202 });
	}
	const bearer = (r) =>
		(r.headers.get("authorization") || "").replace(/^Bearer /, "");
	const app = new Elysia({ serve: { maxRequestBodySize: 262144 } })
		.onAfterHandle(({ set }) => {
			set.headers["X-Content-Type-Options"] = "nosniff";
			set.headers["Referrer-Policy"] = "no-referrer";
			set.headers["X-Frame-Options"] = "DENY";
			set.headers["Content-Security-Policy"] =
				"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
		})
		.onError(({ error, code, set }) => {
			set.status = error.status || (code === "NOT_FOUND" ? 404 : 400);
			return {
				message:
					code === "NOT_FOUND"
						? "Not found"
						: error.message?.includes("Idempotency")
							? error.message
							: "Invalid request",
			};
		})
		.get("/healthz", () => ({ status: "ok" }), detail("Liveness"))
		.use(admin)
		.post(
			"/v1/notify",
			({ request }) => intake(request, "native", null, bearer(request)),
			{ parse: "none", ...detail("Native intake") },
		)
		.post(
			"/api/webhooks/:id/:token",
			({ request, params }) =>
				intake(request, "discord", params.id, params.token),
			{ parse: "none", ...detail("Discord publish subset") },
		)
		.post(
			"/services/:id/:unused/:token",
			({ request, params }) =>
				intake(request, "slack", params.id, params.token),
			{ parse: "none", ...detail("Slack publish subset") },
		)
		.post(
			"/gotify/message",
			({ request, query }) =>
				intake(
					request,
					"gotify",
					null,
					request.headers.get("x-gotify-key") || query.token,
				),
			{ parse: "none", ...detail("Gotify JSON/form subset") },
		)
		.post(
			"/ntfy/:id",
			({ request, params }) =>
				intake(request, "ntfy", params.id, bearer(request)),
			{ parse: "none", ...detail("ntfy text publish subset") },
		)
		.post(
			"/1/messages.json",
			async ({ request }) => {
				const raw = await limitedText(request.clone());
				const b = request.headers.get("content-type")?.includes("json")
					? JSON.parse(raw)
					: Object.fromEntries(new URLSearchParams(raw));
				return intake(request, "pushover", b.user, b.token);
			},
			{ parse: "none", ...detail("Pushover non-emergency subset") },
		)
		.get(
			"/*",
			async ({ params, set }) => {
				if ((params["*"] || "").startsWith("api/")) {
					set.status = 404;
					return { message: "Not found" };
				}
				const root = resolve(import.meta.dir, "../frontend/dist"),
					path = resolve(root, params["*"] || "index.html");
				if (!path.startsWith(root + "/")) {
					set.status = 404;
					return "Not found";
				}
				const file = Bun.file(path);
				if (await file.exists()) return file;
				if ((params["*"] || "").includes(".")) {
					set.status = 404;
					return "Not found";
				}
				return Bun.file(root + "/index.html");
			},
			detail("Frontend assets"),
		);
	return app;
}
