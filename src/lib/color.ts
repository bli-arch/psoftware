export type Hsva = { h: number; s: number; v: number; a: number };

const hexPattern = /^#(?:[\da-f]{6}|[\da-f]{8})$/i;

export function cssColor(value: string | null | undefined, fallback: string | null = null) {
    const color = value?.trim();
    if (!color) return fallback;
    if (hexPattern.test(color)) return color;
    if (/^--[\w-]+$/.test(color)) return `var(${color})`;
    if (/^[a-z][\w-]*$/i.test(color)) return `var(--${color})`;
    return fallback;
}

export function colorToneStyle(value: string | null | undefined, fallback = "var(--user-color)") {
    const color = cssColor(value, fallback);
    if (!color) return undefined;
    return `color:${color};background-color:color-mix(in srgb, ${color} 12%, transparent);`;
}

export function colorToHsva(value: string): Hsva | null {
    let rgba: number[];

    if (value.startsWith("#")) {
        const hex = value.slice(1);
        if (![3, 6, 8].includes(hex.length)) return null;
        const expanded = hex.length === 3 ? [...hex].map((part) => part + part).join("") : hex;
        rgba = [
            Number.parseInt(expanded.slice(0, 2), 16),
            Number.parseInt(expanded.slice(2, 4), 16),
            Number.parseInt(expanded.slice(4, 6), 16),
            expanded.length === 8 ? Number.parseInt(expanded.slice(6), 16) / 255 : 1,
        ];
    } else {
        rgba = (value.match(/[\d.]+/g) ?? []).map(Number);
        if (rgba.length < 3) return null;
        rgba[3] ??= 1;
    }

    const [r, g, b] = rgba.map((channel, index) => index < 3 ? channel / 255 : channel);
    const max = Math.max(r, g, b);
    const delta = max - Math.min(r, g, b);
    const h = !delta ? 0 : max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);

    return {
        h: h < 0 ? h + 360 : h,
        s: max ? delta / max : 0,
        v: max,
        a: Math.min(1, Math.max(0, rgba[3])),
    };
}

export function hsvaToHex({ h, s, v, a }: Hsva, includeAlpha = a < 1) {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    const [r, g, b] =
        h < 60 ? [c, x, 0] :
        h < 120 ? [x, c, 0] :
        h < 180 ? [0, c, x] :
        h < 240 ? [0, x, c] :
        h < 300 ? [x, 0, c] : [c, 0, x];
    const byte = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, "0");

    return `#${byte(r)}${byte(g)}${byte(b)}${includeAlpha ? Math.round(a * 255).toString(16).padStart(2, "0") : ""}`.toUpperCase();
}
