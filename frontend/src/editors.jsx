import React, { useState } from "react";
import { Dialog, FormError } from "./dialog.jsx";
import { Button } from "./ui.jsx";

const FIELD =
	"rounded-lg border border-line-strong bg-raised px-3 py-2 text-[13px] text-ink";
const LABEL = "grid gap-1.5 text-[12px] font-medium text-mute";

// Shared edit/create dialog for a route. Validation mirrors the server contract:
// a non-empty name and at least one destination.
export function RouteDialog({
	open,
	onClose,
	api,
	refresh,
	destinations,
	route,
	onSaved,
}) {
	const [name, setName] = useState(route?.name ?? "");
	const [picked, setPicked] = useState(route?.destinations ?? []);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const dirty =
		name !== (route?.name ?? "") ||
		picked.length !== (route?.destinations ?? []).length;

	async function submit(e) {
		e.preventDefault();
		if (!name.trim()) return setError("Give the route a name.");
		if (!picked.length) return setError("Pick at least one destination.");
		setBusy(true);
		setError("");
		try {
			if (route)
				await api("/routes/" + route.id + "/update", {
					name,
					destinations: picked,
				});
			else await api("/routes", { name, destinations: picked });
			await refresh();
			onSaved(route ? "Route updated" : "Route created");
			onClose();
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog
			open={open}
			title={route ? "Edit route" : "New route"}
			onClose={onClose}
			busy={busy}
			dirty={dirty}
		>
			<form className="grid gap-4" onSubmit={submit}>
				<label className={LABEL}>
					Route name
					<input
						required
						maxLength={100}
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={FIELD}
						placeholder="Operations"
					/>
				</label>
				<fieldset className="grid gap-2">
					<legend className="mb-1 text-[12px] font-medium text-mute">
						Deliver to
					</legend>
					{destinations.length === 0 && (
						<p className="text-[13px] text-mute">
							Connect a destination first.
						</p>
					)}
					{destinations.map((d) => (
						<label
							key={d.id}
							className="flex items-center gap-2 text-[13px] text-dim"
						>
							<input
								type="checkbox"
								checked={picked.includes(d.id)}
								onChange={(e) =>
									setPicked((list) =>
										e.target.checked
											? [...list, d.id]
											: list.filter((x) => x !== d.id),
									)
								}
							/>
							{d.name} <span className="text-mute">· {d.kind}</span>
						</label>
					))}
				</fieldset>
				<FormError message={error} />
				<div className="flex justify-end gap-2 pt-2">
					<Button onClick={onClose} disabled={busy}>
						Cancel
					</Button>
					<Button variant="primary" type="submit" disabled={busy}>
						{route ? "Save route" : "Create route"}
					</Button>
				</div>
			</form>
		</Dialog>
	);
}

// Create a source (generates credentials) or edit one (name + route only).
export function SourceDialog({
	open,
	onClose,
	api,
	refresh,
	routes,
	source,
	onIssued,
	onSaved,
}) {
	const [name, setName] = useState(source?.name ?? "");
	const [route, setRoute] = useState(source?.route ?? routes[0]?.id ?? "");
	const [shape, setShape] = useState("native");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const dirty =
		name !== (source?.name ?? "") ||
		route !== (source?.route ?? routes[0]?.id ?? "");

	async function submit(e) {
		e.preventDefault();
		if (!name.trim()) return setError("Give the service a name.");
		if (!route) return setError("Pick a route.");
		setBusy(true);
		setError("");
		try {
			if (source) {
				await api("/sources/" + source.id + "/update", { name, route });
				onSaved("Source updated");
			} else {
				const s = await api("/sources", { name, route });
				onIssued({ ...s, shape });
			}
			await refresh();
			onClose();
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog
			open={open}
			title={source ? "Edit source" : "Generate credentials"}
			onClose={onClose}
			busy={busy}
			dirty={dirty}
		>
			<form className="grid gap-4" onSubmit={submit}>
				<label className={LABEL}>
					Service name
					<input
						required
						maxLength={100}
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={FIELD}
						placeholder="Backup job"
					/>
				</label>
				<label className={LABEL}>
					Route
					<select
						value={route}
						onChange={(e) => setRoute(e.target.value)}
						className={FIELD}
					>
						{routes.map((r) => (
							<option key={r.id} value={r.id}>
								{r.name}
							</option>
						))}
					</select>
				</label>
				{!source && (
					<label className={LABEL}>
						Compatible intake
						<select
							value={shape}
							onChange={(e) => setShape(e.target.value)}
							className={FIELD}
						>
							{["native", "discord", "slack", "ntfy", "gotify", "pushover"].map(
								(s) => (
									<option key={s} value={s}>
										{s}
									</option>
								),
							)}
						</select>
					</label>
				)}
				<FormError message={error} />
				<div className="flex justify-end gap-2 pt-2">
					<Button onClick={onClose} disabled={busy}>
						Cancel
					</Button>
					<Button variant="primary" type="submit" disabled={busy}>
						{source ? "Save source" : "Generate credentials"}
					</Button>
				</div>
			</form>
		</Dialog>
	);
}
