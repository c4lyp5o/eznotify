import { expect, test } from "bun:test";
import { send, validateDestination } from "../backend/delivery.js";
import { outboundTransport } from "../backend/policy.js";
import { guides } from "../frontend/src/guides.js";

const configs = {
	slack: { url: "https://hooks.slack.com/services/TEST/ONLY/fixture" },
	pushover: { token: "T".repeat(30), user: "U".repeat(30) },
	gotify: { url: "https://gotify.example.test", token: "test-only-token" },
};
test("provider configuration and guided fields match, hostile Slack URLs fail", () => {
	for (const [kind, config] of Object.entries(configs)) {
		expect(() => validateDestination(kind, config)).not.toThrow();
		expect(guides[kind].fields.map(([key]) => key).sort()).toEqual(
			Object.keys(config).sort(),
		);
	}
	for (const url of [
		"http://hooks.slack.com/services/A/B/C",
		"https://hooks.slack.com.evil.test/services/A/B/C",
		"https://user:pass@hooks.slack.com/services/A/B/C",
		"https://hooks.slack.com/services/A/B/C?secret=x",
		"https://hooks.slack.com/other",
	])
		expect(() => validateDestination("slack", { url })).toThrow();
	expect(() =>
		validateDestination("pushover", { token: "bad", user: "bad" }),
	).toThrow();
	expect(() =>
		validateDestination("gotify", { url: configs.gotify.url }),
	).toThrow();
});
test("providers send expected requests through the production origin policy", async () => {
	for (const [kind, config] of Object.entries(configs)) {
		let captured;
		await send(
			{ kind, config },
			{ title: "Test", body: "Hello" },
			outboundTransport(
				kind === "gotify" ? config.url : "",
				async (url, options) => {
					captured = { url, options };
					return Response.json({ status: 1 });
				},
			),
		);
		const { url, options } = captured,
			payload = JSON.parse(options.body);
		expect(options.redirect).toBe("error");
		expect(options.method).toBe("POST");
		if (kind === "slack") {
			expect(url).toBe(config.url);
			expect(payload).toEqual({
				text: "Test\n\nHello",
				mrkdwn: false,
				unfurl_links: false,
				unfurl_media: false,
			});
		} else if (kind === "pushover") {
			expect(url).toBe("https://api.pushover.net/1/messages.json");
			expect(payload).toEqual({ ...config, title: "Test", message: "Hello" });
		} else {
			expect(url).toBe(config.url + "/message");
			expect(options.headers["X-Gotify-Key"]).toBe(config.token);
		}
	}
	expect(() => outboundTransport()(configs.gotify.url)).toThrow();
});
test("limits refuse before network, rejection and retry classifications remain safe", async () => {
	let calls = 0;
	const transport = async () => {
		calls++;
		return Response.json({ status: 1 });
	};
	for (const [kind, length] of [
		["slack", 39001],
		["pushover", 1025],
	]) {
		await expect(
			send(
				{ kind, config: configs[kind] },
				{ title: "", body: "x".repeat(length) },
				transport,
			),
		).rejects.toMatchObject({ retryable: false });
	}
	expect(calls).toBe(0);
	await expect(
		send(
			{ kind: "pushover", config: configs.pushover },
			{ title: "Test", body: "Hello" },
			async () =>
				Response.json({ status: 0, errors: ["private provider detail"] }),
		),
	).rejects.toMatchObject({
		message: "Provider rejected notification",
		retryable: false,
	});
	for (const kind of Object.keys(configs)) {
		for (const status of [400, 429, 500])
			await expect(
				send(
					{ kind, config: configs[kind] },
					{ title: "Test", body: "Hello" },
					async () =>
						new Response("", { status, headers: { "retry-after": "2" } }),
				),
			).rejects.toMatchObject({
				message: "Provider HTTP " + status,
				retryable: status !== 400,
				retryAfter: 2000,
			});
	}
});
