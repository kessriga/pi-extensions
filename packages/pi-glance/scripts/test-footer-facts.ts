import { strict as assert } from "node:assert";
import type { ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { renderExtensionStatusLine, StatusOnlyFooter } from "../footer.js";
import { INPUT_STASH_STATUS_KEY } from "../input-stash.js";
import { setProviderCount } from "../state.js";
import type { GlanceState } from "../types.js";
import { testState } from "./helpers.js";

function providerState(availableCount: number, version = 0): GlanceState {
	return testState({ providers: { availableCount }, version });
}

function fakeTheme(): Theme {
	return {
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
	} as unknown as Theme;
}

function footerData(statuses: ReadonlyMap<string, string> = new Map()): ReadonlyFooterDataProvider {
	return {
		getGitBranch: () => null,
		getExtensionStatuses: () => statuses,
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	};
}

{
	const state = providerState(2, 7);
	assert.equal(setProviderCount(state, 2), false, "same provider count should report no change");
	assert.equal(state.providers.availableCount, 2, "same provider count should preserve availableCount");
	assert.equal(state.version, 7, "same provider count should not bump version");
}

{
	const state = providerState(2, 7);
	assert.equal(setProviderCount(state, 3), true, "different provider count should report changed");
	assert.equal(state.providers.availableCount, 3, "different provider count should update availableCount");
	assert.equal(state.version, 8, "different provider count should bump version once");
	assert.equal(setProviderCount(state, 3), false, "repeated same provider count should report no change");
	assert.equal(state.version, 8, "repeated same provider count should not bump version again");
}

{
	const statuses = new Map([
		["z-last", "  indexing\nfiles  "],
		["a-first", "permission strict"],
	]);
	assert.equal(
		renderExtensionStatusLine(statuses, 80, fakeTheme()),
		"permission strict · indexing files",
		"extension statuses should be sorted, sanitized, and retained",
	);
}

{
	const footer = new StatusOnlyFooter({ theme: fakeTheme(), footerData: footerData() });
	assert.deepEqual(footer.render(80), [], "footer should remain empty when no extension status exists");
	assert.doesNotThrow(() => footer.invalidate(), "footer invalidate should be a no-op");
	assert.doesNotThrow(() => footer.dispose(), "footer dispose should be a no-op");
}

{
	const statuses = new Map([ ["todo", "3 tasks pending"] ]);
	const footer = new StatusOnlyFooter({ theme: fakeTheme(), footerData: footerData(statuses) });
	assert.deepEqual(footer.render(80), ["3 tasks pending"], "footer should preserve extension statuses without optional Pi informational rows");
}

{
	const theme = {
		fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
		bold: (text: string) => text,
	} as unknown as Theme;
	const statuses = new Map([
		[INPUT_STASH_STATUS_KEY, "Press again to discard “throw away”"],
		["todo", "3 tasks pending"],
	]);
	assert.equal(
		renderExtensionStatusLine(statuses, 200, theme),
		"<warning>Press again to discard “throw away”</warning><dim> · </dim>3 tasks pending",
		"input-stash confirm prompts should use warning color in the footer",
	);
}

{
	const theme = {
		fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
		bold: (text: string) => text,
	} as unknown as Theme;
	const statuses = new Map([
		["fast-mode", "fast: on · Ctrl+F"],
		[INPUT_STASH_STATUS_KEY, "Press again to discard “throw away”"],
	]);
	assert.equal(
		renderExtensionStatusLine(statuses, 200, theme),
		"<warning>Press again to discard “throw away”</warning><dim> · </dim>fast: on · Ctrl+F",
		"input-stash confirm prompts should stay left of other extension statuses",
	);
}

{
	const statuses = new Map([
		["usage", "codex 88% ↻ 4d13h"],
		["empty", " \n\t "],
		["memtrace", 'memtrace: connected · repo "Dotfiles" indexed'],
	]);
	assert.equal(
		renderExtensionStatusLine(statuses, 120, fakeTheme()),
		'memtrace: connected · repo "Dotfiles" indexed · codex 88% ↻ 4d13h',
		"footer should separate nonempty extensions without adding leading or trailing dots",
	);
	assert.equal(renderExtensionStatusLine(new Map([["empty", " \n "]]), 80, fakeTheme()), undefined);
	assert.equal(renderExtensionStatusLine(statuses, 0, fakeTheme()), undefined);
}

{
	const calls: Array<[string, string]> = [];
	const theme = {
		fg: (color: string, text: string) => {
			calls.push([color, text]);
			return text;
		},
	} as unknown as Theme;
	for (const [remaining, expected] of [[0, "error"], [10, "error"], [11, "warning"], [25, "warning"], [26, "success"], [100, "success"]] as const) {
		calls.length = 0;
		renderExtensionStatusLine(new Map([["usage", `codex ${remaining}% ↻ 4d13h`]]), 80, theme);
		assert.ok(calls.some(([color, text]) => color === expected && text === `${remaining}%`));
		assert.ok(calls.some(([color, text]) => color === "accent" && text === "codex"));
		assert.ok(calls.some(([color, text]) => color === "dim" && text === "↻ 4d13h"));
	}
	calls.length = 0;
	renderExtensionStatusLine(new Map([["usage", "codex spark 88% 5h 10% wk"]]), 80, theme);
	assert.ok(calls.some(([color, text]) => color === "accent" && text === "codex spark"));
	assert.ok(calls.some(([color, text]) => color === "success" && text === "88%"));
	assert.ok(calls.some(([color, text]) => color === "error" && text === "10%"));
	assert.ok(calls.some(([color, text]) => color === "dim" && text === "5h"));
	assert.ok(calls.some(([color, text]) => color === "dim" && text === "wk"));
	for (const [connection, expected] of [["connected", "success"], ["connecting", "warning"], ["disconnected", "error"]] as const) {
		calls.length = 0;
		renderExtensionStatusLine(new Map([["memtrace", `memtrace: ${connection}`]]), 80, theme);
		assert.ok(calls.some(([color, text]) => color === expected && text === connection));
	}
	for (const [key, status] of [["other", "codex 10%"], ["usage", "context 10%"], ["usage", "codex usage unavailable"], ["memtrace", "memtrace: unexpected status"]]) {
		calls.length = 0;
		assert.equal(renderExtensionStatusLine(new Map([[key!, status!]]), 80, theme), status);
		assert.equal(calls.some(([color]) => color === "error" || color === "success" || color === "warning"), false,
			"unrecognized status text should not acquire quota or connection semantics");
	}
}

{
	let accent = 36;
	const theme = {
		fg: (color: string, text: string) => `\u001b[${color === "accent" ? accent : 2}m${text}\u001b[0m`,
	} as unknown as Theme;
	const statuses = new Map([
		["memtrace", 'memtrace: connected · repo "点" indexed'],
		["usage", "codex 88% ↻ 4d13h"],
	]);
	const footer = new StatusOnlyFooter({ theme, footerData: footerData(statuses) });
	assert.ok(footer.render(120)[0]!.includes("\u001b[36mmemtrace: "));
	accent = 35;
	assert.ok(footer.render(120)[0]!.includes("\u001b[35mmemtrace: "), "colors should resolve from the current theme on each render");
	for (let width = 1; width <= 100; width++) {
		const rendered = footer.render(width)[0] ?? "";
		assert.ok(visibleWidth(rendered) <= width, `colored footer must fit ${width} columns`);
		assert.equal(rendered.includes("\n"), false);
	}
	for (const text of ["codex usage unavailable", "codex no credits", "codex 88% used", "codex 10%", "codex 101% 5h", "codex other-bucket 10% wk"]) {
		assert.equal(renderExtensionStatusLine(new Map([["usage", text]]), 120, theme), text,
			"unknown Codex formats must pass through byte-for-byte even with a nonidentity theme");
	}
	const precolored = "\u001b[31mcodex 10%\u001b[0m";
	assert.equal(renderExtensionStatusLine(new Map([["usage", precolored]]), 80, theme), precolored,
		"existing extension colors should pass through unchanged");
}

console.log("✓ status-only footer checks passed");
