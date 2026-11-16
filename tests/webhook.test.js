import { expect, test } from "bun:test";
import { send, validateDestination } from "../backend/delivery.js";
import { outboundTransport } from "../backend/policy.js";

const config = {
	url: "https://receiver.example.test/notify",
	token: "test-only-bearer",
};
test("webhook validation rejects unsafe URLs and header injection", () => {
	expect(() => validateDestination("webhook", config)).not.toThrow();
	for (const url of [
		"http://receiver.example.test",
		"file:///etc/passwd",
		"https://user:pass@receiver.example.test",
		"https://receiver.example.test/#fragment",
	])
		expect(() => validateDestination("webhook", { url })).toThrow();
	expect(() =>
		validateDestination("webhook", { ...config, token: "bad\r\nHost: evil" }),
	).toThrow();
});
test("webhook uses bounded fixed JSON, bearer auth and production origin guard", async () => {
	let calls = 0;
	const fake = async (url, options) => {
		calls++;
		expect(url).toBe(config.url);
		expect(options.method).toBe("POST");
		expect(options.redirect).toBe("error");
		expect(options.headers.Authorization).toBe("Bearer " + config.token);
		expect(JSON.parse(options.body)).toEqual({ title: "Alert", body: "Hello" });
		return new Response("", { status: 204 });
	};
	const body = { title: "Alert", body: "Hello", privateExtra: "not forwarded" };
	await expect(
		send({ kind: "webhook", config }, body, outboundTransport("", fake)),
	).rejects.toMatchObject({ retryable: false });
	expect(calls).toBe(0);
	await send(
		{ kind: "webhook", config },
		body,
		outboundTransport("https://receiver.example.test", fake),
	);
	expect(calls).toBe(1);
	await expect(
		send(
			{
				kind: "webhook",
				config: { url: "https://receiver.example.test.evil/notify" },
			},
			body,
			outboundTransport("https://receiver.example.test", fake),
		),
	).rejects.toMatchObject({ retryable: false });
	await expect(
		send({ kind: "webhook", config }, { body: "x".repeat(60001) }, fake),
	).rejects.toMatchObject({ retryable: false });
	expect(calls).toBe(1);
});
test("webhook retries transient errors but not permanent refusals or redirects", async () => {
	for (const status of [302, 400, 429, 503])
		await expect(
			send(
				{ kind: "webhook", config },
				{ body: "Hello" },
				async () =>
					new Response("", { status, headers: { "retry-after": "3" } }),
			),
		).rejects.toMatchObject({
			message: "Provider HTTP " + status,
			retryable: status === 429 || status >= 500,
			retryAfter: 3000,
		});
});
