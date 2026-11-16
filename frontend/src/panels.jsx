import { Button, Chip, Empty, fmt, Section, STATE } from "./ui.jsx";

const Row = ({ children }) => <li className="collection-row">{children}</li>;

export function Destinations({ data, busy, onNew, onEdit, onTest }) {
	return (
		<Section
			title="Destinations"
			aside={
				<Button variant="primary" disabled={busy} onClick={onNew}>
					Connect a destination
				</Button>
			}
		>
			{data.destinations.length === 0 ? (
				<Empty
					title="No destinations yet."
					hint="Connect Discord, Telegram, ntfy, Gotify or Matrix. Saving never sends a message; you test explicitly."
				/>
			) : (
				<ul className="divide-y divide-line">
					{data.destinations.map((d) => (
						<Row key={d.id}>
							<div className="min-w-0">
								<p className="truncate font-medium text-ink">{d.name}</p>
								<p className="text-[12px] text-mute">
									{d.kind} · credentials encrypted
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Button disabled={busy} onClick={() => onEdit(d)}>
									Edit
								</Button>
								<Button disabled={busy} onClick={() => onTest(d)}>
									Send test
								</Button>
							</div>
						</Row>
					))}
				</ul>
			)}
		</Section>
	);
}

export function Routes({ data, busy, onNew, onEdit }) {
	return (
		<Section
			title="Routes"
			aside={
				<div className="flex items-center gap-3">
					<Chip>{fmt(data.routes.length)} total</Chip>
					<Button
						variant="primary"
						disabled={busy || data.destinations.length === 0}
						onClick={onNew}
					>
						New route
					</Button>
				</div>
			}
		>
			{data.routes.length === 0 ? (
				<Empty
					title="No routes yet."
					hint="A route sends one source to one or more destinations. Connect a destination first."
				/>
			) : (
				<ul className="divide-y divide-line">
					{data.routes.map((r) => (
						<Row key={r.id}>
							<div className="min-w-0">
								<p className="truncate font-medium text-ink">{r.name}</p>
								<p className="text-[12px] text-mute">
									{fmt(r.destinations.length)} destination
									{r.destinations.length === 1 ? "" : "s"}
								</p>
							</div>
							<Button disabled={busy} onClick={() => onEdit(r)}>
								Edit
							</Button>
						</Row>
					))}
				</ul>
			)}
		</Section>
	);
}

export function Sources({ data, busy, onNew, onEdit, onRotate, onRevoke }) {
	return (
		<Section
			title="Sources"
			aside={
				<Button
					variant="primary"
					disabled={busy || data.routes.length === 0}
					onClick={onNew}
				>
					Generate credentials
				</Button>
			}
		>
			{data.sources.length === 0 ? (
				<Empty
					title="No sources yet."
					hint="A source is one service that sends notifications. Generating credentials shows the endpoint and token once."
				/>
			) : (
				<ul className="divide-y divide-line">
					{data.sources.map((s) => (
						<Row key={s.id}>
							<div className="min-w-0">
								<p className="truncate font-medium text-ink">{s.name}</p>
								<p className="text-[12px] text-mute">
									{data.routes.find((r) => r.id === s.route)?.name ||
										"No route"}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Chip tone={s.revoked ? "bad" : "ok"}>
									{s.revoked ? "Revoked" : "Active"}
								</Chip>
								<Button disabled={busy} onClick={() => onEdit(s)}>
									Edit
								</Button>
								<Button
									disabled={busy || s.revoked}
									onClick={() => onRotate(s)}
								>
									Rotate
								</Button>
								{!s.revoked && (
									<Button
										variant="danger"
										disabled={busy}
										onClick={() => onRevoke(s)}
									>
										Revoke
									</Button>
								)}
							</div>
						</Row>
					))}
				</ul>
			)}
		</Section>
	);
}

export function Delivery({ data, busy, onRefresh, onRetry }) {
	const failed = data.jobs.filter((j) => j.state === "failed").length;
	const rows = [...data.jobs].sort(
		(a, b) => STATE[a.state]?.rank - STATE[b.state]?.rank,
	);
	const destName = (id) =>
		data.destinations.find((d) => d.id === id)?.name || "Destination";
	return (
		<Section
			title="Delivery"
			aside={
				<div className="flex items-center gap-3">
					<span className="text-[13px] text-mute">
						{failed ? (
							<span className="text-bad">{fmt(failed)} need attention</span>
						) : (
							"Nothing needs attention"
						)}
					</span>
					<Button disabled={busy} onClick={onRefresh}>
						Refresh
					</Button>
				</div>
			}
		>
			{rows.length === 0 ? (
				<Empty
					title="No deliveries yet."
					hint="Publish a notification from a source and each destination's outcome appears here, independently."
				/>
			) : (
				<ul className="divide-y divide-line">
					{rows.map((j) => {
						const s = STATE[j.state] ?? { label: j.state, tone: "neutral" };
						return (
							<Row key={j.id}>
								<div className="min-w-0">
									<p className="truncate font-medium text-ink">
										{destName(j.destination)}
									</p>
									<p className="text-[12px] text-mute">
										{j.notification.slice(0, 8)} · {fmt(j.attempts)} retr
										{j.attempts === 1 ? "y" : "ies"}
										{j.error ? ` · ${j.error}` : ""}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Chip tone={s.tone}>{s.label}</Chip>
									{j.state === "failed" && (
										<Button disabled={busy} onClick={() => onRetry(j)}>
											Retry
										</Button>
									)}
								</div>
							</Row>
						);
					})}
				</ul>
			)}
		</Section>
	);
}
