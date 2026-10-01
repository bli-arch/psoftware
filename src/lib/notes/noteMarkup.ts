export type NoteMarkupToken =
    | { type: "text"; value: string }
    | { type: "italic"; value: string }
    | { type: "bold"; value: string }
    | { type: "boldItalic"; value: string }
    | { type: "badge"; value: string }
    | { type: "strikethrough"; value: string }
    | { type: "underline"; value: string }
    | { type: "link"; label: string; href: string }
    | { type: "color"; color: string; value: string };

type DelimitedRule = {
    type: Exclude<NoteMarkupToken["type"], "text" | "link" | "color">;
    marker: string;
};

export const NOTE_MARKUP_RULES: DelimitedRule[] = [
    { type: "boldItalic", marker: "***" },
    { type: "bold", marker: "**" },
    { type: "italic", marker: "*" },
    { type: "badge", marker: "`" },
    { type: "strikethrough", marker: "~~" },
    { type: "underline", marker: "_" },
];

const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const COLOR_PREFIX = "{color:";
const ALLOWED_NAMED_COLORS = new Set(["red", "green", "blue", "orange"]);
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const normalizeNoteColor = (color: string): string | null => {
    const trimmed = color.trim();
    const lower = trimmed.toLowerCase();

    if (ALLOWED_NAMED_COLORS.has(lower)) return lower;
    if (HEX_COLOR_PATTERN.test(trimmed)) return trimmed;

    return null;
};

export const normalizeLinkHref = (href: string): string | null => {
    const trimmed = href.trim();
    if (!trimmed) return null;

    try {
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.toString();
    } catch {
        return null;
    }
};

const findNextLink = (text: string, fromIndex: number) => {
    LINK_PATTERN.lastIndex = fromIndex;

    let match = LINK_PATTERN.exec(text);
    while (match) {
        const safeHref = normalizeLinkHref(match[2] ?? "");
        if (safeHref) {
            return {
                start: match.index,
                end: match.index + match[0].length,
                token: {
                    type: "link",
                    label: match[1],
                    href: safeHref,
                } satisfies NoteMarkupToken,
            };
        }

        match = LINK_PATTERN.exec(text);
    }

    return null;
};

const findColorEnd = (text: string, contentStart: number) => {
    let depth = 0;
    let separator = -1;
    let cursor = contentStart;

    while (cursor < text.length) {
        if (text.startsWith(COLOR_PREFIX, cursor)) {
            depth += 1;
            cursor += COLOR_PREFIX.length;
            continue;
        }

        const char = text[cursor];
        if (char === "}" && depth === 0) return { end: cursor, separator };
        if (char === "}" && depth > 0) {
            depth -= 1;
            cursor += 1;
            continue;
        }
        if (char === "|" && depth === 0 && separator === -1) separator = cursor;

        cursor += 1;
    }

    return null;
};

const findNextColor = (text: string, fromIndex: number) => {
    let searchIndex = fromIndex;
    let start = text.indexOf(COLOR_PREFIX, searchIndex);

    while (start !== -1) {
        const contentStart = start + COLOR_PREFIX.length;
        const colorEnd = findColorEnd(text, contentStart);

        if (!colorEnd) return null;
        if (colorEnd.separator !== -1) {
            const color = normalizeNoteColor(text.slice(contentStart, colorEnd.separator));

            if (color) {
                return {
                    start,
                    end: colorEnd.end + 1,
                    token: {
                        type: "color",
                        color,
                        value: text.slice(colorEnd.separator + 1, colorEnd.end),
                    } satisfies NoteMarkupToken,
                };
            }
        }

        searchIndex = start + 1;
        start = text.indexOf(COLOR_PREFIX, searchIndex);
    }

    return null;
};

const findNextDelimited = (text: string, fromIndex: number) => {
    let best:
        | {
            start: number;
            end: number;
            priority: number;
            token: NoteMarkupToken;
        }
        | null = null;

    NOTE_MARKUP_RULES.forEach((rule, priority) => {
        const start = text.indexOf(rule.marker, fromIndex);
        if (start === -1) return;

        const valueStart = start + rule.marker.length;
        const endMarker = text.indexOf(rule.marker, valueStart);
        if (endMarker === -1 || endMarker === valueStart) return;

        if (best && (start > best.start || (start === best.start && priority > best.priority))) return;

        best = {
            start,
            end: endMarker + rule.marker.length,
            priority,
            token: {
                type: rule.type,
                value: text.slice(valueStart, endMarker),
            } as NoteMarkupToken,
        };
    });

    return best;
};

export const parseNoteMarkup = (text: string): NoteMarkupToken[] => {
    const tokens: NoteMarkupToken[] = [];
    let cursor = 0;

    while (cursor < text.length) {
        const link = findNextLink(text, cursor);
        const color = findNextColor(text, cursor);
        const delimited = findNextDelimited(text, cursor);
        const next = [link, color, delimited]
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => a.start - b.start)[0];

        if (!next) {
            tokens.push({ type: "text", value: text.slice(cursor) });
            break;
        }

        if (next.start > cursor) {
            tokens.push({ type: "text", value: text.slice(cursor, next.start) });
        }

        tokens.push(next.token);
        cursor = next.end;
    }

    return tokens;
};
