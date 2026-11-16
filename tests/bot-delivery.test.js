import { expect, test } from "bun:test";
import { send, validateDestination } from "../backend/delivery.js";

test("Discord bot uses fixed endpoint, Bot authorization and suppresses mentions", async () => {
	const config = { token: "fixture-only", channelId: "123456789012345678" };
	validateDestination("discord-bot", config);
	expect(() =>
		validateDestination("discord-bot", { ...config, channelId: "../bad" }),
	).toThrow();
	expect(() =>
		validateDestination("discord-bot", { ...config, token: "Bot invalid" }),
	).toThrow();
	await send(
		{ kind: "discord-bot", config },
		{ body: "@everyone test" },
		async (url, options) => {
			expect(url).toBe(
				"https://discord.com/api/v10/channels/" +
					config.channelId +
					"/messages",
			);
			expect(options.headers.Authorization).toBe("Bot fixture-only");
			expect(JSON.parse(options.body).allowed_mentions).toEqual({ parse: [] });
			expect(options.redirect).toBe("error");
			return new Response("{}", { status: 200 });
		},
	);
	await expect(
		send({ kind: "discord-bot", config }, { body: "x".repeat(2001) }, () => {
			throw Error("must not call");
		}),
	).rejects.toThrow("limit");
	await expect(
		send(
			{ kind: "discord-bot", config },
			{ body: "test" },
			async () => new Response("{}", { status: 403 }),
		),
	).rejects.toMatchObject({ retryable: false });
});
test("Matrix fails closed on encrypted, forbidden or unknown state; sends only after M_NOT_FOUND", async () => {
	const d = {
		kind: "matrix",
		config: {
			url: "https://matrix.example",
			token: "fixture",
			roomId: "!room:example",
		},
	};
	for (const status of [200, 403, 500, 404]) {
		let calls = 0;
		await expect(
			send(d, { body: "test" }, async () => {
				calls++;
				return Response.json(
					status === 200
						? { algorithm: "m.megolm.v1.aes-sha2" }
						: { errcode: "M_FORBIDDEN" },
					{ status },
				);
			}),
		).rejects.toThrow("safety check");
		expect(calls).toBe(1);
	}
	let calls = 0;
	await send(d, { body: "test" }, async (url, options) => {
		calls++;
		if (calls === 1) {
			expect(url).toContain("/state/m.room.encryption");
			return Response.json({ errcode: "M_NOT_FOUND" }, { status: 404 });
		}
		expect(options.method).toBe("PUT");
		expect(JSON.parse(options.body).body).toBe("test");
		return Response.json({ event_id: "fixture" });
	});
	expect(calls).toBe(2);
});
