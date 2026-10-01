type ScanCallback = (value: string) => void;

interface BarcodeScannerOptions {
    regex?: string;
    timeout?: number;
    minLength?: number;
    minLengthOnTimeout?: number;
    ignoreEditable?: boolean;
}

function stringToAnchoredRegex(regexStr: string, flags: string = ""): RegExp {
    if (!regexStr.startsWith("^")) regexStr = "^" + regexStr;
    if (!regexStr.endsWith("$")) regexStr = regexStr + "$";
    return new RegExp(regexStr, flags);
}

export function setupBarcodeScanner(
    callback: ScanCallback,
    options: BarcodeScannerOptions = {}
) {
    let buffer = "";
    let timer: number | null = null;
    const timeout = options.timeout ?? 50;
    const effectiveRegex = options.regex ? stringToAnchoredRegex(options.regex) : undefined;

    function flush(minLength = options.minLength ?? 3) {
        const value = buffer;
        buffer = "";
        if (value.length < minLength || (effectiveRegex && !effectiveRegex.test(value))) return false;
        callback(value);
        return true;
    }

    function handler(e: KeyboardEvent) {
        if (timer) clearTimeout(timer);

        const target = e.target;
        if (options.ignoreEditable && target instanceof HTMLElement
            && (target.matches("input, textarea, select") || target.isContentEditable)) {
            buffer = "";
            return;
        }

        if (e.key === "Enter" || e.key === "Tab") {
            if (flush()) {
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            buffer += e.key;
        }

        timer = setTimeout(() => {
            flush(options.minLengthOnTimeout ?? options.minLength ?? 3);
        }, timeout);
    }

    document.addEventListener('keydown', handler);

    return {
        destroy() {
            document.removeEventListener('keydown', handler);
        }
    };
}
