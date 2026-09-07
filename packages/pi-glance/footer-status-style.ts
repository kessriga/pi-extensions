import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

const CODEX_QUOTA_STATUS = /^codex(?: (?:fast|spark))?(?: (?:100|[0-9]{1,2})% (?:5h|wk|↻ (?:now|<1m|(?:[0-9]+[dhms])+)))+$/;

function quotaColor(remaining: number): ThemeColor {
	if (remaining <= 10) return "error";
	if (remaining <= 25) return "warning";
	return "success";
}

function styleCodexUsage(text: string, theme: Theme): string {
	return text.replace(
		/^(codex(?: (?:fast|spark))?)\b|(\d+(?:\.\d+)?%)|(↻\s+\S+)|\b(5h|wk)\b/g,
		(token, label: string | undefined, percent: string | undefined) => {
			if (label) return theme.fg("accent", token);
			if (percent) {
				const remaining = Number(percent.slice(0, -1));
				return remaining <= 100 ? theme.fg(quotaColor(remaining), token) : token;
			}
			return theme.fg("dim", token);
		},
	);
}

function styleMemtraceStatus(text: string, theme: Theme): string {
	const match = text.match(/^(memtrace: )(connected|disconnected|connecting)(?=$| · )/);
	if (!match) return text;
	const [, label, connection] = match;
	const color = connection === "connected" ? "success" : connection === "disconnected" ? "error" : "warning";
	return theme.fg("accent", label!)
		+ theme.fg(color, connection!)
		+ theme.fg("dim", text.slice(match[0].length));
}

export function styleExtensionStatus(key: string, text: string, theme: Theme): string {
	if (text.includes("\u001b")) return text;
	if (key === "usage" && CODEX_QUOTA_STATUS.test(text)) return styleCodexUsage(text, theme);
	if (key === "memtrace") return styleMemtraceStatus(text, theme);
	return text;
}
