import { get, writable } from "svelte/store";

type PanelRect = {
    id: string;
    layer: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

type PositionRequest = Omit<PanelRect, "x" | "y"> & {
    x: number;
    y: number;
    previousX: number;
    previousY: number;
    margin?: number;
    gap?: number;
};

const panels = writable<Record<string, PanelRect>>({});

const distance = (a: PanelRect, b: Pick<PanelRect, "x" | "y">) => Math.hypot(a.x - b.x, a.y - b.y);
const intersects = (a: PanelRect, b: PanelRect, gap: number) =>
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y;

export function registerFloatingPanel(panel: PanelRect) {
    panels.update((list) => ({ ...list, [panel.id]: panel }));
}

export function unregisterFloatingPanel(id: string) {
    panels.update(({ [id]: _removed, ...list }) => list);
}

export function placeFloatingPanel(request: PositionRequest) {
    const margin = request.margin ?? 12;
    const gap = request.gap ?? 8;
    const maxX = Math.max(margin, window.innerWidth - request.width - margin);
    const maxY = Math.max(margin, window.innerHeight - request.height - margin);
    const clampRect = (rect: PanelRect): PanelRect => ({
        ...rect,
        x: Math.min(Math.max(rect.x, margin), maxX),
        y: Math.min(Math.max(rect.y, margin), maxY)
    });
    const desired = clampRect({ ...request, x: request.x, y: request.y });
    const previous = clampRect({ ...request, x: request.previousX, y: request.previousY });
    const others = Object.values(get(panels)).filter(
        (panel) => panel.id !== request.id && panel.layer === request.layer
    );

    if (!others.some((panel) => intersects(desired, panel, gap))) return desired;

    const candidates = others.flatMap((panel) => [
        clampRect({ ...desired, x: panel.x - request.width - gap }),
        clampRect({ ...desired, x: panel.x + panel.width + gap }),
        clampRect({ ...desired, y: panel.y - request.height - gap }),
        clampRect({ ...desired, y: panel.y + panel.height + gap })
    ]);
    const free = candidates.filter((candidate) => !others.some((panel) => intersects(candidate, panel, gap)));

    if (free.length) return [...free].sort((a, b) => distance(a, desired) - distance(b, desired))[0];
    return previous;
}
