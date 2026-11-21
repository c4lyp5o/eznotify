import {
	Activity,
	Bell,
	LockKeyhole,
	LogOut,
	Menu,
	Plug,
	Radio,
	Route,
	SunMoon,
} from "lucide-react";

// The GitHub mark shared by the ez* apps' sidebars (lucide 1.x dropped brand icons).
function GitHubMark() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			focusable="false"
		>
			<path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
		</svg>
	);
}

import { motion, useReducedMotion } from "motion/react";
import React, { useEffect, useState } from "react";
import { Dialog } from "./dialog.jsx";
import { RouteDialog, SourceDialog } from "./editors.jsx";
import Onboarding from "./Onboarding.jsx";
import Overview from "./overview.jsx";
import { Delivery, Destinations, Routes, Sources } from "./panels.jsx";
import { Button, Chip, fmt, Notice } from "./ui.jsx";

const TABS = [
	{
		key: "Overview",
		icon: Activity,
		lead: "Your notification paths and delivery outcomes, at a glance.",
	},
	{
		key: "Destinations",
		icon: Radio,
		lead: "Connect platforms once. Each step is explained; saving never sends.",
	},
	{
		key: "Routes",
		icon: Route,
		lead: "One route fans a single source out to several destinations.",
	},
	{
		key: "Sources",
		icon: Plug,
		lead: "One credential per service. Shown once when generated.",
	},
	{
		key: "Delivery",
		icon: Activity,
		lead: "Accepted is not delivered. Each destination is tracked on its own.",
	},
];

const INTAKE = {
	native: { path: () => "/v1/notify", note: "Authorization: Bearer <token>" },
	discord: {
		path: (f) => "/api/webhooks/" + f.id + "/" + f.token,
		note: "Paste this full URL as the Discord webhook.",
	},
	slack: {
		path: (f) => "/services/" + f.id + "/notify/" + f.token,
		note: "Paste this full URL as the Slack webhook.",
	},
	ntfy: {
		path: (f) => "/ntfy/" + f.id,
		note: "Authorization: Bearer <token>. Base URL: this host.",
	},
	gotify: {
		path: () => "/gotify/message",
		note: "Header X-Gotify-Key: <token>. Base URL: this host + /gotify.",
	},
	pushover: {
		path: () => "/1/messages.json",
		note: "token = <token>, user = ",
	},
};

const FIELD =
	"rounded-lg border border-line-strong bg-raised px-3 py-2 text-[13px] text-ink";

export default function Shell() {
	const reduced = useReducedMotion();
	const [drawer, setDrawer] = useState(false);
	useEffect(() => {
		if (!drawer) return;
		const opener = document.activeElement;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const rail = document.querySelector(".workspace-rail");
		const items = () => [...rail.querySelectorAll("button,a[href]")];
		items()[0]?.focus();
		const onKey = (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				setDrawer(false);
			}
			if (e.key === "Tab") {
				const nodes = items(),
					first = nodes[0],
					last = nodes[nodes.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = previous;
			document.removeEventListener("keydown", onKey);
			opener?.focus();
		};
	}, [drawer]);
	const [updated, setUpdated] = useState(null);
	const [syncError, setSyncError] = useState(false);
	const [token, setToken] = useState("");
	const [input, setInput] = useState("");
	const [data, setData] = useState(null);
	const [tab, setTab] = useState("Overview");
	const [notice, setNotice] = useState({ text: "", tone: "neutral" });
	const [busy, setBusy] = useState(false);
	const [fresh, setFresh] = useState(null);
	const [dialog, setDialog] = useState(null); // { kind, item? }

	async function api(path, body, key = token) {
		const r = await fetch("/api" + path, {
			method: body ? "POST" : "GET",
			headers: {
				Authorization: "Bearer " + key,
				"Content-Type": "application/json",
			},
			...(body ? { body: JSON.stringify(body) } : {}),
		});
		const value = await r.json();
		if (!r.ok) throw new Error(value.message || "Request failed");
		return value;
	}
	async function refresh() {
		setData(await api("/state"));
		setUpdated(Date.now());
		setSyncError(false);
	}
	function say(text, tone = "neutral") {
		setNotice({ text, tone });
	}
	async function act(fn) {
		setBusy(true);
		setNotice({ text: "", tone: "neutral" });
		try {
			await fn();
		} catch (e) {
			say(e.message, "bad");
		} finally {
			setBusy(false);
		}
	}
	function lock() {
		setToken("");
		setData(null);
		setFresh(null);
		setDialog(null);
	}
	const close = () => setDialog(null);
	useEffect(() => {
		if (!token) return;
		let stopped = false,
			timer,
			controller;
		const poll = async () => {
			if (!document.hidden) {
				controller = new AbortController();
				try {
					const response = await fetch("/api/state", {
						headers: { Authorization: "Bearer " + token },
						signal: AbortSignal.any([
							controller.signal,
							AbortSignal.timeout(10000),
						]),
					});
					if (response.status === 401) {
						if (!stopped) lock();
						return;
					}
					if (!response.ok) throw new Error("Refresh failed");
					const next = await response.json();
					if (!stopped) {
						setData(next);
						setUpdated(Date.now());
						setSyncError(false);
					}
				} catch {
					if (!stopped) setSyncError(true);
				}
			}
			if (!stopped) timer = setTimeout(poll, 5000);
		};
		timer = setTimeout(poll, 5000);
		return () => {
			stopped = true;
			clearTimeout(timer);
			controller?.abort();
		};
	}, [token]);

	if (!data) {
		return (
			<main className="login-stage">
				<motion.section
					className="login-card"
					initial={{ opacity: 0, y: reduced ? 0 : 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: reduced ? 0 : 0.32 }}
				>
					<div className="login-brand">
						<img src="/icons/icon-192.png" alt="" width="20" height="20" />
						<span>eznotify</span>
					</div>
					<h1 className="mt-6 text-[20px] font-semibold text-ink">
						Sign in to eznotify
					</h1>
					<p className="mt-1 text-mute">One integration. Every destination.</p>
					<form
						className="mt-8"
						onSubmit={(e) => {
							e.preventDefault();
							act(async () => {
								const state = await api("/state", null, input);
								setToken(input);
								setInput("");
								setData(state);
								setUpdated(Date.now());
							});
						}}
					>
						<label className="block text-[12px] font-medium text-mute">
							Admin token
							<input
								className={"mt-1.5 w-full " + FIELD}
								autoComplete="off"
								type="password"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								required
							/>
						</label>
						<Button
							variant="primary"
							className="mt-4 w-full"
							disabled={busy}
							type="submit"
						>
							<LockKeyhole size={15} /> Unlock workspace
						</Button>
					</form>
					<p className="mt-4 text-[12px] text-mute">
						Your token stays in memory. Reloading locks the workspace.
					</p>
					<div className="mt-4">
						<Notice tone="bad">{notice.text}</Notice>
					</div>
				</motion.section>
			</main>
		);
	}

	const current = TABS.find((t) => t.key === tab);
	const failedJobs = data.jobs.filter((j) => j.state === "failed").length;
	const intake = fresh ? INTAKE[fresh.shape] : null;

	return (
		<div className="workspace">
			<header className="mobile-bar">
				<button
					type="button"
					aria-label="Open menu"
					onClick={() => setDrawer(true)}
				>
					<Menu size={16} />
				</button>
				<img src="/icons/icon-192.png" alt="" width="20" height="20" />
				<span>eznotify</span>
			</header>
			{drawer && (
				<button
					type="button"
					className="drawer-backdrop"
					aria-label="Close menu"
					onClick={() => setDrawer(false)}
				/>
			)}
			<aside
				className={"workspace-rail" + (drawer ? " drawer-open" : "")}
				onKeyDown={(e) => {
					if (e.key === "Escape") setDrawer(false);
				}}
			>
				<div className="workspace-brand">
					<img src="/icons/icon-192.png" alt="" width="20" height="20" />{" "}
					<span className="wordmark">eznotify</span>
					<span className="text-[11px] font-normal text-mute">0.1.0</span>
				</div>

				<nav aria-label="Sections" className="workspace-nav">
					{TABS.map(({ key, icon: Icon }) => {
						const active = key === tab;
						return (
							<button
								key={key}
								type="button"
								aria-current={active ? "page" : undefined}
								onClick={() => {
									setTab(key);
									setDrawer(false);
									setFresh(null);
									setNotice({ text: "", tone: "neutral" });
								}}
								className={
									"flex items-center gap-2 whitespace-nowrap rounded px-2 py-2 text-left text-[13px] font-medium transition-colors " +
									(active
										? "text-ink"
										: "text-mute hover:bg-hover hover:text-ink")
								}
							>
								<Icon size={16} />
								<span className="relative inline-block pb-px">
									{key}
									{key === "Delivery" && failedJobs > 0 && (
										<span className="ml-2 rounded-full bg-bad-dim px-1.5 text-[11px] text-bad">
											{fmt(failedJobs)}
										</span>
									)}
									{active && (
										<motion.span
											layoutId="nav-selection"
											transition={{ duration: reduced ? 0 : 0.22 }}
											className="absolute inset-x-0 -bottom-px h-px bg-accent"
											aria-hidden
										/>
									)}
								</span>
							</button>
						);
					})}
				</nav>
				<div className="rail-footer">
					<a
						href="https://github.com/c4lyp5o"
						target="_blank"
						rel="noreferrer noopener"
						aria-label="GitHub"
					>
						<GitHubMark />
					</a>
					<Button
						onClick={() => document.documentElement.classList.toggle("dark")}
						aria-label="Toggle theme"
					>
						<SunMoon size={15} />
					</Button>
					<Button onClick={lock} aria-label="Lock workspace">
						<LogOut size={16} />
					</Button>
				</div>
			</aside>

			<main className="workspace-main">
				<header className="page-heading">
					<h1>{tab}</h1>
					<p>{current.lead}</p>
				</header>
				<motion.div
					key={tab}
					initial={{ opacity: 0, y: reduced ? 0 : 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: reduced ? 0 : 0.32 }}
				>
					<Notice tone={notice.tone} onDismiss={() => say("")}>
						{notice.text}
					</Notice>

					{tab === "Overview" && (
						<Overview
							updated={updated}
							syncError={syncError}
							data={data}
							busy={busy}
							onNavigate={setTab}
							onRefresh={() => act(refresh)}
							onRetry={(j) =>
								act(async () => {
									const r = await api("/jobs/" + j.id + "/retry", {});
									say(r.message, "ok");
									await refresh();
								})
							}
						/>
					)}
					{tab === "Destinations" && (
						<Destinations
							data={data}
							busy={busy}
							onNew={() => setDialog({ kind: "wizard" })}
							onEdit={(d) => setDialog({ kind: "wizard", item: d })}
							onTest={(d) =>
								act(async () => {
									const r = await api("/destinations/" + d.id + "/test", {});
									say(r.message, "ok");
								})
							}
						/>
					)}

					{tab === "Routes" && (
						<Routes
							data={data}
							busy={busy}
							onNew={() => setDialog({ kind: "route" })}
							onEdit={(r) => setDialog({ kind: "route", item: r })}
						/>
					)}

					{tab === "Sources" && (
						<Sources
							data={data}
							busy={busy}
							onNew={() => setDialog({ kind: "source" })}
							onEdit={(s) => setDialog({ kind: "source", item: s })}
							onRotate={(s) =>
								act(async () => {
									const r = await api("/sources/" + s.id + "/rotate", {});
									setFresh({ ...r, shape: "native" });
									await refresh();
								})
							}
							onRevoke={(s) =>
								act(async () => {
									const r = await api("/sources/" + s.id + "/revoke", {});
									say(r.message, "ok");
									await refresh();
								})
							}
						/>
					)}

					{tab === "Delivery" && (
						<Delivery
							data={data}
							busy={busy}
							onRefresh={() => act(refresh)}
							onRetry={(j) =>
								act(async () => {
									const r = await api("/jobs/" + j.id + "/retry", {});
									say(r.message, "ok");
									await refresh();
								})
							}
						/>
					)}

					{fresh && intake && (
						<section className="mt-6 rounded-md border border-line bg-surface p-5">
							<div className="mb-3 flex items-center justify-between gap-3">
								<h2 className="text-[15px] font-semibold text-ink">
									Copy now · shown once
								</h2>
								<Chip tone="warn">Not stored in plain text</Chip>
							</div>
							<p className="mb-3 text-[13px] text-mute">
								Save these in your service's notification settings. This is an
								eznotify credential, not a platform bot token.
							</p>
							<label className="grid gap-1.5 text-[12px] font-medium text-mute">
								Endpoint
								<input
									readOnly
									value={location.origin + intake.path(fresh)}
									className={"font-code " + FIELD}
								/>
							</label>
							{!["discord", "slack"].includes(fresh.shape) && (
								<label className="mt-4 grid gap-1.5 text-[12px] font-medium text-mute">
									Token
									<input
										readOnly
										value={fresh.token}
										className={"font-code " + FIELD}
									/>
								</label>
							)}
							<p className="mt-3 text-[12px] text-mute">
								{intake.note}
								{fresh.shape === "pushover" ? fresh.id : ""}
							</p>
							<div className="mt-4 flex justify-end">
								<Button onClick={() => setFresh(null)}>
									Done, I've saved it
								</Button>
							</div>
						</section>
					)}
				</motion.div>
			</main>

			<Dialog
				open={dialog?.kind === "wizard"}
				title={dialog?.item ? "Replace configuration" : "Connect a destination"}
				onClose={close}
				width="max-w-[640px]"
			>
				{dialog?.kind === "wizard" && (
					<Onboarding
						api={api}
						refresh={refresh}
						edit={dialog.item || null}
						onDone={() => {
							close();
							say("Destination saved. Send a test when you're ready.", "ok");
						}}
					/>
				)}
			</Dialog>

			{dialog?.kind === "route" && (
				<RouteDialog
					open
					onClose={close}
					api={api}
					refresh={refresh}
					destinations={data.destinations}
					route={dialog.item}
					onSaved={(t) => say(t, "ok")}
				/>
			)}

			{dialog?.kind === "source" && (
				<SourceDialog
					open
					onClose={close}
					api={api}
					refresh={refresh}
					routes={data.routes}
					source={dialog.item}
					onIssued={(s) => setFresh(s)}
					onSaved={(t) => say(t, "ok")}
				/>
			)}
		</div>
	);
}
