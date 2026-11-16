import { validateDestination } from "./delivery.js";
export function onboarding(app, transport) {
	const info = (summary) => ({ detail: { summary, tags: ["Onboarding"] } });
	async function telegram(token, method) {
		validateDestination("telegram", { token, chatId: "validation" });
		const r = await transport(
			"https://api.telegram.org/bot" + token + "/" + method,
			{ signal: AbortSignal.timeout(10000), redirect: "error" },
		);
		const b = await r.json();
		if (!r.ok || !b.ok) throw new Error("Telegram check failed");
		return b.result;
	}
	return app
		.post(
			"/onboarding/validate",
			async ({ body, set }) => {
				try {
					validateDestination(body.kind, body.config);
					if (body.kind === "telegram") {
						const bot = await telegram(body.config.token, "getMe");
						return {
							message:
								"Bot credentials validated: @" +
								bot.username +
								". Chat delivery still requires a test.",
							level: "credentials",
						};
					}
					return {
						message:
							"Configuration format validated only. Use an explicit test to check provider acceptance.",
						level: "format",
					};
				} catch {
					set.status = 400;
					return {
						message:
							"Validation failed. Check required fields, token, permissions and connectivity.",
					};
				}
			},
			info("Validate configuration without sending a notification"),
		)
		.post(
			"/onboarding/telegram/chats",
			async ({ body, set }) => {
				try {
					const hook = await telegram(body.token, "getWebhookInfo");
					if (hook.url) {
						set.status = 409;
						return {
							message:
								"This bot has an active webhook. Use a dedicated bot or enter the chat ID manually; eznotify will not remove the webhook.",
						};
					}
					const updates = await telegram(body.token, "getUpdates");
					const chats = new Map();
					for (const u of updates) {
						const c =
							u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat;
						if (c)
							chats.set(String(c.id), {
								id: String(c.id),
								name:
									c.title ||
									[c.first_name, c.last_name].filter(Boolean).join(" ") ||
									c.username ||
									String(c.id),
							});
					}
					return {
						chats: [...chats.values()],
						message:
							"Choose and confirm the intended chat. Discovery does not send a message or acknowledge updates.",
					};
				} catch {
					set.status = 400;
					return {
						message:
							"Discovery failed. Start the bot and send a fresh message, then retry. Another poller may be using this bot.",
					};
				}
			},
			info("Discover Telegram chat candidates without consuming updates"),
		);
}
