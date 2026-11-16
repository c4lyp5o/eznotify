export function normalize(kind, body, headers = new Headers()) {
	const text = (x) => (typeof x === "string" ? x : "");
	let title = text(body?.title),
		message = "";
	if (kind === "native") message = text(body?.body);
	if (kind === "discord") {
		if (body.components || body.poll || body.files)
			throw new Error("Unsupported Discord feature");
		message = [
			text(body.content),
			...(body.embeds || []).map((e) =>
				[
					e.title,
					e.description,
					...(e.fields || []).map((f) => f.name + ": " + f.value),
					e.footer?.text,
					e.url,
				]
					.filter(Boolean)
					.join("\n"),
			),
		]
			.filter(Boolean)
			.join("\n\n");
	}
	if (kind === "slack") {
		message = [
			text(body.text),
			...(body.blocks || []).map(
				(b) =>
					b.text?.text || (b.elements || []).map((e) => e.text || "").join(" "),
			),
			...(body.attachments || []).map((a) =>
				[
					a.title,
					a.text,
					...(a.fields || []).map((f) => f.title + ": " + f.value),
				]
					.filter(Boolean)
					.join("\n"),
			),
		]
			.filter(Boolean)
			.join("\n");
	}
	if (["gotify", "pushover"].includes(kind)) message = text(body.message);
	if (kind === "pushover" && Number(body.priority) === 2)
		throw new Error("Emergency receipts are not supported");
	if (kind === "ntfy") {
		if (
			body?.delay ||
			headers.has("Delay") ||
			headers.has("Actions") ||
			body?.actions
		)
			throw new Error("Scheduled delivery/actions unsupported");
		message = typeof body === "string" ? body : text(body.message);
		title = title || headers.get("Title") || headers.get("X-Title") || "";
	}
	if (!message.trim() || message.length > 60000 || title.length > 500)
		throw new Error("Message is empty or exceeds limits");
	return { title, body: message };
}
