import { randomBytes } from "node:crypto";
import { validateDestination } from "./delivery.js";
import { hash } from "./store.js";
export function management(app, store) {
	const db = store.db;
	const exists = (table, id) => {
		if (!db.query("SELECT id FROM " + table + " WHERE id=?").get(id))
			throw Object.assign(new Error("Not found"), { status: 404 });
	};
	const info = (summary) => ({ detail: { summary, tags: ["Management"] } });
	const name = (value) => {
		if (typeof value !== "string" || !value.trim() || value.trim().length > 100)
			throw Object.assign(new Error("Name must contain 1–100 characters"), {
				status: 400,
			});
		return value.trim();
	};
	const credential = db.transaction((id, secret, revoked) => {
		db.query("UPDATE sources SET hash=? WHERE id=?").run(hash(secret), id);
		db.query(
			"INSERT INTO source_status(source,revoked) VALUES(?,?) ON CONFLICT(source) DO UPDATE SET revoked=excluded.revoked",
		).run(id, revoked);
	});
	return app
		.post(
			"/destinations/:id/rename",
			({ params, body }) => {
				exists("destinations", params.id);
				db.query("UPDATE destinations SET name=? WHERE id=?").run(
					name(body?.name),
					params.id,
				);
				return { message: "Destination renamed; credentials unchanged" };
			},
			info("Rename a destination without replacing credentials"),
		)
		.post(
			"/sources/:id/update",
			({ params, body }) => {
				exists("sources", params.id);
				const label = name(body?.name);
				if (typeof body?.route !== "string")
					throw Object.assign(new Error("Route required"), { status: 400 });
				exists("routes", body.route);
				db.query("UPDATE sources SET name=?,route=? WHERE id=?").run(
					label,
					body.route,
					params.id,
				);
				return {
					message: "Source updated; queued jobs and credentials unchanged",
				};
			},
			info("Edit source name and route for future notifications"),
		)
		.post(
			"/destinations/:id/update",
			({ params, body }) => {
				exists("destinations", params.id);
				validateDestination(body.kind, body.config);
				if (!body.name?.trim()) throw new Error("Name required");
				db.query(
					"UPDATE destinations SET name=?,kind=?,secret=? WHERE id=?",
				).run(
					body.name.slice(0, 100),
					body.kind,
					store.seal(body.config),
					params.id,
				);
				return { message: "Updated; validate and test again" };
			},
			info("Replace destination configuration without returning saved secrets"),
		)
		.post(
			"/routes/:id/update",
			({ params, body }) => {
				exists("routes", params.id);
				if (
					!body.name?.trim() ||
					!Array.isArray(body.destinations) ||
					!body.destinations.length
				)
					throw new Error("Route requires destinations");
				const ids = [...new Set(body.destinations)];
				for (const id of ids) exists("destinations", id);
				db.query("UPDATE routes SET name=?,destinations=? WHERE id=?").run(
					body.name.slice(0, 100),
					JSON.stringify(ids),
					params.id,
				);
				return { message: "Route updated; queued jobs unchanged" };
			},
			info("Update route membership for future notifications"),
		)
		.post(
			"/sources/:id/rotate",
			({ params }) => {
				exists("sources", params.id);
				const token = randomBytes(32).toString("hex");
				credential.immediate(params.id, token, 0);
				return { id: params.id, token };
			},
			info("Rotate source secret immediately"),
		)
		.post(
			"/sources/:id/revoke",
			({ params }) => {
				exists("sources", params.id);
				credential.immediate(params.id, randomBytes(64), 1);
				return { message: "Source revoked; accepted jobs unchanged" };
			},
			info("Revoke source credentials"),
		)
		.post(
			"/jobs/:id/retry",
			({ params, set }) => {
				const result = db
					.query(
						"UPDATE jobs SET state='pending',attempts=0,due=0,error=NULL WHERE id=? AND state='failed'",
					)
					.run(params.id);
				if (!result.changes) {
					set.status = 409;
					return { message: "Only failed deliveries can be retried" };
				}
				return { message: "Selected failed delivery queued" };
			},
			info("Retry one failed delivery, never successful siblings"),
		);
}
