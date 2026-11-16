import nodemailer from "nodemailer";

const mailbox =
	/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
export function validateSmtp(c) {
	if (
		typeof c.host !== "string" ||
		!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(c.host) ||
		!["465", "587"].includes(String(c.port)) ||
		![c.from, c.to].every(
			(v) => typeof v === "string" && v.length <= 254 && mailbox.test(v),
		) ||
		typeof c.username !== "string" ||
		!c.username.trim() ||
		/[\r\n]/.test(c.username) ||
		typeof c.password !== "string" ||
		!c.password
	)
		throw new Error(
			"SMTP requires host, port 465/587, credentials and single sender/recipient mailboxes",
		);
}
export async function sendSmtp(
	c,
	body,
	createTransport = nodemailer.createTransport,
	allowed = process.env.EZNOTIFY_SMTP_SERVERS || "",
) {
	validateSmtp(c);
	if (
		!allowed
			.split(",")
			.map((v) => v.trim().toLowerCase())
			.includes(c.host.toLowerCase() + ":" + c.port)
	)
		throw Object.assign(new Error("SMTP server denied"), { retryable: false });
	if (/[\r\n]/.test(body.title || ""))
		throw Object.assign(new Error("Invalid email subject"), {
			retryable: false,
		});
	const client = createTransport({
		host: c.host,
		port: Number(c.port),
		secure: String(c.port) === "465",
		requireTLS: true,
		tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
		auth: { user: c.username, pass: c.password },
		connectionTimeout: 10000,
		greetingTimeout: 10000,
		socketTimeout: 10000,
		logger: false,
		debug: false,
		disableFileAccess: true,
		disableUrlAccess: true,
	});
	try {
		const result = await client.sendMail({
			from: c.from,
			to: c.to,
			subject: body.title || "eznotify",
			text: body.body,
		});
		if (!result.accepted?.length || result.rejected?.length)
			throw Object.assign(new Error("SMTP recipient rejected"), {
				responseCode: 550,
			});
	} catch (error) {
		throw Object.assign(new Error("SMTP delivery failed"), {
			retryable:
				error.code !== "EAUTH" &&
				!(error.responseCode >= 500 && error.responseCode < 600),
		});
	} finally {
		client.close();
	}
}
