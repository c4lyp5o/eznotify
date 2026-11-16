import React, { useState } from "react";
import { guides } from "./guides.js";
export default function Onboarding({ api, refresh, edit, onDone }) {
	const [kind, setKind] = useState(edit?.kind || "discord"),
		[step, setStep] = useState(0),
		[values, setValues] = useState({ name: edit?.name || "" }),
		[message, setMessage] = useState(""),
		[busy, setBusy] = useState(false),
		[saved, setSaved] = useState(null),
		[validated, setValidated] = useState(false),
		[chats, setChats] = useState([]);
	const g = guides[kind],
		{ name, ...config } = values;
	async function run(fn) {
		setBusy(true);
		setMessage("");
		try {
			await fn();
		} catch (e) {
			setMessage(e.message);
		} finally {
			setBusy(false);
		}
	}
	function field(id, value) {
		setValues((v) => ({ ...v, [id]: value }));
		setValidated(false);
	}
	return (
		<section>
			<h2>{edit ? "Replace" : "Connect"} a destination</h2>
			<p className="eyebrow">
				STEP {step + 1} OF 4 ·{" "}
				{
					["PLATFORM", "INSTRUCTIONS", "CONFIGURE & VALIDATE", "SAVE & TEST"][
						step
					]
				}
			</p>
			{step === 0 && (
				<>
					<label>
						Platform
						<select
							value={kind}
							disabled={!!edit}
							onChange={(e) => {
								setKind(e.target.value);
								setValues({ name: "" });
							}}
						>
							{Object.entries(guides).map(([k, v]) => (
								<option key={k} value={k}>
									{v.name}
								</option>
							))}
						</select>
					</label>
					<p>{g.description}</p>
				</>
			)}
			{step === 1 && (
				<>
					<ol>
						{g.steps.map((s) => (
							<li key={s}>{s}</li>
						))}
					</ol>
					<a href={g.link} target="_blank" rel="noreferrer">
						Official setup reference ↗
					</a>
					{edit && (
						<p>
							Re-enter the complete configuration. Saved credentials are never
							returned to your browser.
						</p>
					)}
				</>
			)}
			{step === 2 && (
				<>
					<label>
						Destination name
						<input
							value={name}
							onChange={(e) => field("name", e.target.value)}
						/>
					</label>
					{g.fields.map(([id, label, type]) => (
						<label key={id}>
							{label}
							<input
								type={type}
								autoComplete="off"
								value={values[id] || ""}
								onChange={(e) => field(id, e.target.value)}
							/>
						</label>
					))}
					{kind === "telegram" && (
						<>
							<button
								disabled={busy}
								onClick={() =>
									run(async () => {
										const r = await api("/onboarding/telegram/chats", {
											token: values.token,
										});
										setChats(r.chats);
										setMessage(
											r.chats.length
												? r.message
												: "No chats found. Start the bot and send a fresh message.",
										);
									})
								}
							>
								Discover chats
							</button>
							{chats.map((c) => (
								<button key={c.id} onClick={() => field("chatId", c.id)}>
									{c.name} ({c.id})
								</button>
							))}
							<p>Confirm the selected chat ID before continuing.</p>
						</>
					)}
					<button
						disabled={busy || !name?.trim()}
						onClick={() =>
							run(async () => {
								const r = await api("/onboarding/validate", { kind, config });
								setValidated(true);
								setMessage(r.message);
							})
						}
					>
						Validate configuration
					</button>
				</>
			)}
			{step === 3 && (
				<>
					<p>
						Validated configuration is not proof of delivery. Save first, then
						explicitly send a test.
					</p>
					<button
						disabled={busy || !!saved}
						onClick={() =>
							run(async () => {
								const r = await api(
									edit
										? "/destinations/" + edit.id + "/update"
										: "/destinations",
									{ kind, name, config },
								);
								setSaved(edit?.id || r.id);
								setValues({ name });
								await refresh();
								setMessage(
									"Saved encrypted. Credentials cleared from the form.",
								);
							})
						}
					>
						Save destination
					</button>
					<button
						disabled={busy || !saved}
						onClick={() =>
							run(async () => {
								const r = await api("/destinations/" + saved + "/test", {});
								setMessage(r.message);
							})
						}
					>
						Send test notification
					</button>
					<button disabled={!saved || busy} onClick={onDone}>
						Done
					</button>
				</>
			)}
			<p role="status">{message}</p>
			<div className="row">
				{step > 0 && !saved && (
					<button disabled={busy} onClick={() => setStep(step - 1)}>
						Back
					</button>
				)}
				{step < 3 && (
					<button
						disabled={busy || (step === 2 && !validated)}
						onClick={() => {
							setMessage("");
							setStep(step + 1);
						}}
					>
						Continue
					</button>
				)}
			</div>
		</section>
	);
}
