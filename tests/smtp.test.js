import { expect, test } from "bun:test";
import { createServer } from "node:net";
import nodemailer from "nodemailer";
import { validateDestination } from "../backend/delivery.js";
import { sendSmtp } from "../backend/smtp.js";

const c = {
	host: "smtp.example.test",
	port: "587",
	username: "test-only-user",
	password: "test-only-password",
	from: "sender@example.test",
	to: "recipient@example.test",
};
const body = { title: "Test email", body: "Plain text notification" };
const allowed = c.host + ":" + c.port;
test("SMTP validation rejects header injection, lists, URLs and insecure ports", () => {
	expect(() => validateDestination("smtp", c)).not.toThrow();
	for (const patch of [
		{ host: "https://mail.example.test" },
		{ port: "25" },
		{ to: "a@example.test,b@example.test" },
		{ from: "a@example.test\r\nBcc:x@example.test" },
		{ password: "" },
	])
		expect(() => validateDestination("smtp", { ...c, ...patch })).toThrow();
});
test("SMTP policy denies before connection; TLS and sanitized errors remain mandatory", async () => {
	let calls = 0;
	await expect(
		sendSmtp(
			c,
			body,
			() => {
				calls++;
			},
			"",
		),
	).rejects.toMatchObject({ retryable: false });
	await expect(
		sendSmtp(
			c,
			{ ...body, title: "bad\r\nBcc: x" },
			() => {
				calls++;
			},
			allowed,
		),
	).rejects.toMatchObject({ retryable: false });
	expect(calls).toBe(0);
	for (const port of ["465", "587"]) {
		let closed = false;
		await sendSmtp(
			{ ...c, port },
			body,
			(options) => {
				expect(options.secure).toBe(port === "465");
				expect(options.requireTLS).toBe(true);
				expect(options.tls.rejectUnauthorized).toBe(true);
				expect(options.disableFileAccess).toBe(true);
				return {
					sendMail: async () => ({ accepted: [c.to], rejected: [] }),
					close: () => {
						closed = true;
					},
				};
			},
			c.host + ":" + port,
		);
		expect(closed).toBe(true);
	}
	for (const [error, retryable] of [
		[{ responseCode: 450 }, true],
		[{ responseCode: 550 }, false],
		[{ code: "EAUTH" }, false],
		[{ code: "ETIMEDOUT" }, true],
	]) {
		await expect(
			sendSmtp(
				c,
				body,
				() => ({
					sendMail: async () => {
						throw { ...error, message: "private credential" };
					},
					close() {},
				}),
				allowed,
			),
		).rejects.toMatchObject({ message: "SMTP delivery failed", retryable });
	}
});
test("real Nodemailer composes plain-text MIME and correct envelope", async () => {
	let result;
	await sendSmtp(
		c,
		body,
		() => {
			const stream = nodemailer.createTransport({
				streamTransport: true,
				buffer: true,
			});
			return {
				sendMail: async (message) => {
					result = await stream.sendMail(message);
					return { accepted: [c.to], rejected: [] };
				},
				close: () => stream.close(),
			};
		},
		allowed,
	);
	expect(result.envelope).toEqual({ from: c.from, to: [c.to] });
	expect(result.message.toString()).toContain("Subject: Test email");
	expect(result.message.toString()).toContain("Content-Type: text/plain");
	expect(result.message.toString()).toContain(body.body);
});
test("real SMTP connection refuses STARTTLS downgrade without authenticating", async () => {
	const commands = [];
	const sockets = new Set();
	const server = createServer((socket) => {
		sockets.add(socket);
		socket.on("error", () => {});
		socket.write("220 test-only SMTP\r\n");
		socket.on("data", (data) => {
			commands.push(data.toString());
			if (data.toString().startsWith("EHLO")) socket.write("250 test-only\r\n");
			else socket.write("502 TLS unavailable\r\n");
		});
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		await expect(
			sendSmtp(
				c,
				body,
				(options) =>
					nodemailer.createTransport({
						...options,
						host: "127.0.0.1",
						port: server.address().port,
					}),
				allowed,
			),
		).rejects.toThrow("SMTP delivery failed");
		expect(commands.join("")).toContain("STARTTLS");
		expect(commands.join("")).not.toContain("AUTH");
	} finally {
		for (const socket of sockets) socket.destroy();
		await new Promise((resolve) => server.close(resolve));
	}
});
