import { sendSmtp, validateSmtp } from "./smtp.js";

export function validateDestination(kind, config) {
	if (kind === "smtp") return validateSmtp(config);
	if (kind === "webhook") {
		const url = new URL(config.url);
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			url.hash ||
			(config.token !== undefined &&
				(typeof config.token !== "string" || /[\r\n]/.test(config.token)))
		)
			throw new Error(
				"Use an HTTPS webhook URL and valid optional bearer token",
			);
		return;
	}
	if (
		![
			"discord",
			"discord-bot",
			"telegram",
			"gotify",
			"slack",
			"pushover",
			"ntfy",
			"matrix",
		].includes(kind)
	)
		throw new Error("Unsupported destination");
	if (kind === "discord-bot") {
		if (
			typeof config.token !== "string" ||
			!config.token.trim() ||
			/\s/.test(config.token) ||
			!/^[0-9]{17,20}$/.test(config.channelId || "")
		)
			throw new Error("Discord bot token and channel ID required");
		return;
	}
	if (kind === "telegram") {
		if (!/^[0-9]+:[A-Za-z0-9_-]+$/.test(config.token || "") || !config.chatId)
			throw new Error("Bot token and chat ID required");
		return;
	}
	if (kind === "pushover") {
		if (
			!/^[A-Za-z0-9]{30}$/.test(config.token || "") ||
			!/^[A-Za-z0-9]{30}$/.test(config.user || "")
		)
			throw new Error("Pushover application token and user/group key required");
		return;
	}
	const url = new URL(config.url);
	if (
		kind === "slack" &&
		(url.protocol !== "https:" ||
			url.hostname !== "hooks.slack.com" ||
			url.port ||
			!/^\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(
				url.pathname,
			) ||
			url.search ||
			url.hash)
	)
		throw new Error("Use a Slack incoming webhook URL");
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password
	)
		throw new Error("Invalid server URL");
	if (
		kind === "discord" &&
		(url.protocol !== "https:" ||
			!["discord.com", "discordapp.com"].includes(url.hostname) ||
			!url.pathname.startsWith("/api/webhooks/"))
	)
		throw new Error("Use a Discord webhook URL");
	if (kind === "gotify" && !config.token)
		throw new Error("Gotify application token required");
	if (kind === "matrix" && (!config.token || !config.roomId))
		throw new Error(
			"Matrix access token and room ID required (unencrypted rooms only)",
		);
}
export async function send(destination, body, transport = fetch) {
	const c = destination.config,
		text = [body.title, body.body].filter(Boolean).join("\n\n");
	const limit = ["discord", "discord-bot"].includes(destination.kind)
		? 1950
		: destination.kind === "telegram"
			? 4000
			: 60000;
	if (text.length > limit)
		throw Object.assign(new Error("Message exceeds destination limit"), {
			retryable: false,
		});
	if (
		(destination.kind === "pushover" &&
			(body.body.length > 1024 || (body.title || "").length > 250)) ||
		(destination.kind === "slack" && text.length > 39000)
	)
		throw Object.assign(new Error("Message exceeds destination limit"), {
			retryable: false,
		});
	if (destination.kind === "smtp") return sendSmtp(c, body);
	let url = c.url,
		payload,
		headers = { "Content-Type": "application/json" };
	switch (destination.kind) {
		case "webhook":
			validateDestination("webhook", c);
			payload = { title: body.title || "", body: body.body };
			if (c.token) headers.Authorization = "Bearer " + c.token;
			break;
		case "discord-bot":
			url = "https://discord.com/api/v10/channels/" + c.channelId + "/messages";
			headers.Authorization = "Bot " + c.token;
			payload = { content: text, allowed_mentions: { parse: [] } };
			break;
		case "discord":
			payload = {
				content: text.slice(0, 1950),
				allowed_mentions: { parse: [] },
			};
			break;
		case "telegram":
			url = "https://api.telegram.org/bot" + c.token + "/sendMessage";
			payload = { chat_id: c.chatId, text: text.slice(0, 4000) };
			break;
		case "slack":
			payload = {
				text,
				mrkdwn: false,
				unfurl_links: false,
				unfurl_media: false,
			};
			break;
		case "pushover":
			url = "https://api.pushover.net/1/messages.json";
			payload = {
				token: c.token,
				user: c.user,
				title: body.title,
				message: body.body,
			};
			break;
		case "gotify":
			url = c.url.replace(/\/$/, "") + "/message";
			headers["X-Gotify-Key"] = c.token;
			payload = { title: body.title, message: body.body, priority: 5 };
			break;
		case "ntfy":
			payload = {
				topic: c.topic || "alerts",
				title: body.title,
				message: body.body,
			};
			if (c.token) headers.Authorization = "Bearer " + c.token;
			break;
		case "matrix": {
			const check = await transport(
				c.url.replace(/\/$/, "") +
					"/_matrix/client/v3/rooms/" +
					encodeURIComponent(c.roomId) +
					"/state/m.room.encryption",
				{
					headers: { Authorization: "Bearer " + c.token },
					signal: AbortSignal.timeout(10000),
					redirect: "error",
				},
			);
			const state = await check.json();
			if (check.status !== 404 || state.errcode !== "M_NOT_FOUND")
				throw Object.assign(
					new Error("Matrix room encryption safety check failed"),
					{ retryable: false },
				);
			url =
				c.url.replace(/\/$/, "") +
				"/_matrix/client/v3/rooms/" +
				encodeURIComponent(c.roomId) +
				"/send/m.room.message/" +
				crypto.randomUUID();
			headers.Authorization = "Bearer " + c.token;
			payload = { msgtype: "m.text", body: text };
			break;
		}
		default:
			throw new Error("Unsupported destination");
	}
	const response = await transport(url, {
		method: destination.kind === "matrix" ? "PUT" : "POST",
		headers,
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(10000),
		redirect: "error",
	});
	if (response.ok && destination.kind === "pushover") {
		let result;
		try {
			result = await response.json();
		} catch {
			throw new Error("Provider returned invalid response");
		}
		if (result.status !== 1)
			throw Object.assign(new Error("Provider rejected notification"), {
				retryable: false,
			});
	}
	if (!response.ok) {
		const err = new Error("Provider HTTP " + response.status);
		err.retryable = response.status === 429 || response.status >= 500;
		err.retryAfter = Math.min(
			3600000,
			Math.max(0, Number(response.headers.get("retry-after")) * 1000 || 0),
		);
		throw err;
	}
}
export function createWorker(store, transport = fetch) {
	let busy = false;
	return async function tick() {
		if (busy) return;
		busy = true;
		try {
			const jobs = store.db
				.query(
					"SELECT j.*,n.body,d.kind,d.secret FROM jobs j JOIN notifications n ON n.id=j.notification JOIN destinations d ON d.id=j.destination WHERE j.state='pending' AND j.due<=? ORDER BY j.rowid LIMIT 10",
				)
				.all(Date.now());
			for (const job of jobs) {
				try {
					await send(
						{ kind: job.kind, config: store.unseal(job.secret) },
						JSON.parse(job.body),
						transport,
					);
					store.db
						.query("UPDATE jobs SET state='delivered',error=NULL WHERE id=?")
						.run(job.id);
				} catch (e) {
					const attempts = job.attempts + 1;
					store.db
						.query(
							"UPDATE jobs SET state=?,attempts=?,due=?,error=? WHERE id=?",
						)
						.run(
							e.retryable === false || attempts >= 8 ? "failed" : "pending",
							attempts,
							Date.now() +
								Math.max(
									e.retryAfter || 0,
									1000 * 2 ** attempts + Math.random() * 1000,
								),
							e.message.startsWith("Provider HTTP")
								? e.message
								: "Transport failed",
							job.id,
						);
				}
			}
		} finally {
			busy = false;
		}
	};
}
