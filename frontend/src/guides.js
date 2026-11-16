export const guides = {
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
			"Enter the server base URL and application token. Save, then send a test.",
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
