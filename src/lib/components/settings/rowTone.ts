export function getRowTone(toneClass: string) {
    const background = toneClass.match(/\bbg-(?:([a-z]+)-\d+|\((--[\w-]+)\))(?:\/(\d+))?/);
    const tint = background?.[1]
        ? `var(--color-${background[1]}-50)`
        : background?.[3]
            ? `color-mix(in srgb, var(${background[2]}) ${background[3]}%, white)`
            : `var(${background?.[2] ?? "--light-bg2"})`;

    return {
        iconClass: toneClass.split(/\s+/).filter((name) => !name.startsWith("bg-")).join(" "),
        background: `background: linear-gradient(45deg, ${tint}, white 24%);`,
    };
}
