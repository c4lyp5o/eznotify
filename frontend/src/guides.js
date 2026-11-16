export const guides = {
	webhook: {
		name: "Generic webhook",
		description: "Send a fixed JSON notification to an HTTPS endpoint.",
		steps: [
			"Create an HTTPS receiver accepting POST with JSON fields title and body. Custom payload templates and arbitrary headers are not supported.",
			"Ask the operator to add the exact receiver origin to EZNOTIFY_OUTBOUND_ORIGINS and restart eznotify. Redirects and plaintext HTTP are refused.",
			"Enter the full receiver URL and an optional bearer token. URLs and tokens are stored encrypted; keep them private.",
			"Validate, save, then explicitly send a test. A 2xx response means receiver acceptance, not downstream delivery.",
			"Receivers should tolerate duplicate requests: transient failures and ambiguous acceptance can cause retries. Avoid endpoints that trigger unsafe repeated actions.",
		],
		fields: [
			["url", "HTTPS receiver URL", "password"],
			["token", "Bearer token (optional)", "password"],
		],
		link: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST",
	},
	smtp: {
		name: "Email / SMTP",
		description:
			"Plain-text email through an authenticated TLS SMTP submission server.",
		steps: [
			"Get SMTP submission settings from your mail provider. Use port 465 for implicit TLS or 587 for mandatory STARTTLS. Plaintext SMTP is not supported.",
			"Create a dedicated account or app password. OAuth-only accounts are not supported; never disable certificate verification.",
			"Ask the eznotify operator to allow the exact host:port in EZNOTIFY_SMTP_SERVERS, then restart the service. This is separate from the HTTPS origin allowlist.",
			"Enter the SMTP host (no URL), port, username, password, permitted sender and one recipient email address. Use bare mailboxes, not display names or lists.",
			"Validate the format, save, then explicitly send a test. Confirm receipt and check spam. Server acceptance does not guarantee inbox delivery; configure SPF/DKIM/DMARC with your mail provider.",
		],
		fields: [
			["host", "SMTP host", "text"],
			["port", "Port (465 or 587)", "number"],
			["username", "Username", "text"],
			["password", "App password", "password"],
			["from", "Sender address", "email"],
			["to", "Recipient address", "email"],
		],
		link: "https://nodemailer.com/smtp",
	},
	slack: {
		name: "Slack",
		description:
			"Post plain-text notifications to a channel using an incoming webhook.",
		steps: [
			"Create a Slack app at api.slack.com/apps in the destination workspace.",
			"Enable Incoming Webhooks, then Add New Webhook to Workspace and authorize the intended channel.",
			"Copy the hooks.slack.com webhook URL. Treat the entire URL as a secret.",
			"Paste it below, validate, save and explicitly send a test. Confirm receipt in the selected channel.",
		],
		fields: [["url", "Incoming webhook URL", "password"]],
		link: "https://api.slack.com/messaging/webhooks",
	},
	pushover: {
		name: "Pushover",
		description:
			"Send normal-priority push notifications to your Pushover devices.",
		steps: [
			"Install Pushover on your phone and sign in. Device licensing may require a purchase.",
			"Sign in at pushover.net and copy your User Key, or use a delivery group key.",
			"Create an application/API token named eznotify. Keep both keys private.",
			"Enter the application token and user/group key. Validate, save, then explicitly send a test and confirm receipt.",
			"Messages are limited to 1024 characters and titles to 250. Oversize messages fail rather than truncate. Emergency priority is not supported.",
		],
		fields: [
			["token", "Application API token", "password"],
			["user", "User / group key", "password"],
		],
		link: "https://pushover.net/api",
	},
	"discord-bot": {
		name: "Discord bot",
		description:
			"Send using an existing bot token and channel ID. No gateway connection or message-content intent needed.",
		steps: [
			"Create an application in Discord Developer Portal → Bot, or use your existing bot. Keep its token secret.",
			"Install the bot in your server with the bot scope. Grant View Channel and Send Messages for the destination channel; do not grant Administrator.",
			"Enable Developer Mode in Discord settings, then right-click the channel → Copy Channel ID.",
			"Enter the bot token without a Bot prefix and the channel ID. Save, then explicitly send a test. Mentions are disabled.",
		],
		fields: [
			["token", "Bot token", "password"],
			["channelId", "Channel ID", "text"],
		],
		link: "https://discord.com/developers/docs/resources/message#create-message",
	},
	discord: {
		name: "Discord",
		description:
			"A webhook is all you need for channel notifications. No bot or broad permissions.",
		steps: [
			"Open your Discord server and choose the destination channel.",
			"Open Edit Channel → Integrations → Webhooks → New Webhook. You need Manage Webhooks permission.",
			"Name the webhook eznotify, confirm the channel, then Copy Webhook URL.",
			"Paste the URL below, save, and explicitly send a test. Anyone holding this URL can post—keep it secret.",
		],
		fields: [["url", "Webhook URL", "password"]],
		link: "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks",
	},
	telegram: {
		name: "Telegram",
		description:
			"Create your own bot. Your token stays encrypted on this server.",
		steps: [
			"Open the verified @BotFather account in Telegram. Run /newbot and choose a name and unique username.",
			"Copy its bot token. Do not share it in chats or screenshots.",
			"For personal alerts: open your new bot and tap Start. For a group: add the bot, then send a command addressed to it.",
			"Use Discover chats in the next step, then confirm the intended chat ID. Use a dedicated bot: an existing webhook prevents discovery and will not be removed.",
			"Enter the token and confirmed chat ID, validate, save, then explicitly send a test. Confirm receipt on your device.",
		],
		fields: [
			["token", "Bot token", "password"],
			["chatId", "Chat ID", "text"],
		],
		link: "https://core.telegram.org/bots/tutorial",
	},
	gotify: {
		name: "Gotify",
		description:
			"Connect an existing Gotify server using an application token—not a client token.",
		steps: [
			"Open your Gotify server and sign in.",
			"Go to Apps and create an application named eznotify.",
			"Copy the application token. Confirm the Gotify server is reachable from the eznotify server.",
			"Allow the exact HTTPS server origin in EZNOTIFY_OUTBOUND_ORIGINS on eznotify, then enter its base URL and application token. Validate, save, then send a test.",
			"Subscribe with your Gotify client to receive the message.",
		],
		fields: [
			["url", "Server base URL", "url"],
			["token", "Application token", "password"],
		],
		link: "https://gotify.net/docs/pushmsg",
	},
	ntfy: {
		name: "ntfy",
		description: "Choose a topic and subscribe on your phone before testing.",
		steps: [
			"Choose ntfy.sh or your existing self-hosted ntfy server.",
			"Create a topic and configure authentication/access controls on your server. A hard-to-guess topic is not access control.",
			"Subscribe to that same server and topic in the ntfy app.",
			"Enter the server base URL, topic, and access token if required. Save and send a test.",
			"On public servers, remember that an unprotected topic can be readable by others.",
		],
		fields: [
			["url", "Server base URL", "url"],
			["topic", "Topic", "text"],
			["token", "Access token (optional)", "password"],
		],
		link: "https://docs.ntfy.sh/publish/",
	},
	matrix: {
		name: "Matrix",
		description:
			"Unencrypted rooms only in this version. Encrypted-room delivery is not supported.",
		steps: [
			"Create a dedicated bot account on your homeserver using a trusted Matrix client.",
			"Create an unencrypted private room, invite the bot, and make sure it has joined. Public rooms can be read by anyone—avoid them for real alerts.",
			"Obtain the bot access token securely from your client or homeserver tooling.",
			"Enter the homeserver base URL, access token and internal room ID (not its display name).",
			"Save and send a test. Do not use this adapter for encrypted rooms.",
		],
		fields: [
			["url", "Homeserver base URL", "url"],
			["token", "Access token", "password"],
			["roomId", "Room ID", "text"],
		],
		link: "https://spec.matrix.org/latest/client-server-api/",
	},
};
