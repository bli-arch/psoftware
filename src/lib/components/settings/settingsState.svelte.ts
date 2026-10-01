type BooleanKey<T> = {
    [K in keyof T]: T[K] extends boolean ? K : never;
}[keyof T];

export type SettingsValues<T extends Record<string, unknown>> = {
    readonly values: T;
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): void;
    toggle<K extends BooleanKey<T>>(key: K): void;
    patch(values: Partial<T>): void;
    reset(values?: Partial<T>): void;
    snapshot(): T;
};

export function createSettingsValues<T extends Record<string, unknown>>(initialValues: T): SettingsValues<T> {
    const initial = { ...initialValues };
    let values = $state({ ...initialValues }) as T;

    return {
        get values() {
            return values;
        },
        get(key) {
            return values[key];
        },
        set(key, value) {
            values[key] = value;
        },
        toggle(key) {
            values[key] = !values[key] as T[typeof key];
        },
        patch(nextValues) {
            Object.assign(values, nextValues);
        },
        reset(nextValues = {}) {
            Object.assign(values, initial, nextValues);
        },
        snapshot() {
            return { ...values };
        },
    };
}
