import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";
import { animationTime } from "$lib/uiPreferences";
 
type FlyAndScaleParams = {
 y?: number;
 x?: number;
 start?: number;
 duration?: number;
};
 
export const flyAndScale = (
 node: Element,
 params: FlyAndScaleParams = { y: -8, x: 0, start: 0.95 }
): TransitionConfig => {
 const style = getComputedStyle(node);
 const transform = style.transform === "none" ? "" : style.transform;
 
 const scaleConversion = (
  valueA: number,
  scaleA: [number, number],
  scaleB: [number, number]
 ) => {
  const [minA, maxA] = scaleA;
  const [minB, maxB] = scaleB;
 
  const percentage = (valueA - minA) / (maxA - minA);
  const valueB = percentage * (maxB - minB) + minB;
 
  return valueB;
 };
 
 const styleToString = (
  style: Record<string, number | string | undefined>
 ): string => {
  return Object.keys(style).reduce((str, key) => {
   if (style[key] === undefined) return str;
   return str + key + ":" + style[key] + ";";
  }, "");
 };
 
 return {
  duration: animationTime(params.duration ?? 150),
  delay: 0,
  css: (t) => {
   const y = scaleConversion(t, [0, 1], [params.y ?? 5, 0]);
   const x = scaleConversion(t, [0, 1], [params.x ?? 0, 0]);
   const scale = scaleConversion(t, [0, 1], [params.start ?? 0.95, 1]);
 
   return styleToString({
    transform:
     transform +
     "translate3d(" +
     x +
     "px, " +
     y +
     "px, 0) scale(" +
     scale +
     ")",
    opacity: t,
   });
  },
  easing: cubicOut,
 };
};


/**
 * Formats a Date object using strftime-style format codes,
 * with optional locale support for month and day names.
 *
 * @param date - A valid Date object to be formatted.
 * @param format - A string containing format codes (starting with `%` with optional ^/_ modifiers).
 * @param locale - Optional locale string (e.g., 'en-US', 'fr-FR'). Defaults to the system locale.
 *
 * ### Supported Format Codes:
 *
 * #### Date Components:
 * - `%Y`: 4-digit year (e.g., 2023)
 * - `%y`: 2-digit year (e.g., 23)
 * - `%m`: 2-digit month (01-12)
 * - `%d`: 2-digit day of the month (01-31)
 * - `%w`: Weekday as a number (Sunday is 0)
 * - `%H`: 2-digit hour in 24-hour format (00-23)
 * - `%I`: 2-digit hour in 12-hour format (01-12)
 * - `%M`: 2-digit minute (00-59)
 * - `%S`: 2-digit second (00-59)
 * - `%f`: 6-digit microsecond (000000-999999)
 * - `%p`: AM or PM
 * - `%A`: Full weekday name (locale-aware)
 * - `%a`: Abbreviated weekday name (locale-aware)
 * - `%B`: Full month name (locale-aware)
 * - `%b`: Abbreviated month name (locale-aware)
 * - `%j`: Day of the year (001-366)
 * - `%U`: Week number (Sunday as the first day) (00-53)
 * - `%W`: Week number (Monday as the first day) (00-53)
 *
 * #### Composite Formats:
 * - `%c`: Local date and time representation (locale-aware)
 * - `%x`: Local date representation (locale-aware)
 * - `%X`: Local time representation (locale-aware)
 *
 * #### Timezone:
 * - `%Z`: Timezone name (e.g., "UTC", "EST")
 * - `%z`: UTC offset (e.g., "+0000", "-0500")
 *
 * #### Special:
 * - `%s`: Unix timestamp in seconds
 * - `%%`: Literal percent sign
 *  * Format codes support modifiers for capitalization:
 * - %^A - Uppercase weekday (MONDAY)
 * - %_A - Lowercase weekday (monday)
 * - %A  - Title case weekday (Monday)
 * 
 * Applies similarly to: %A, %a, %B, %b
 */
export function strftime(date: Date | string, format: string, locale?: string): string {
    const pad = (n: number, len: number = 2): string => n.toString().padStart(len, '0');
    const calendarMatch = typeof date === "string"
        ? date.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/)
        : null;
    const safeDate = calendarMatch
        ? (() => {
            const year = Number(calendarMatch[1]);
            const month = Number(calendarMatch[2] ?? 1);
            const day = Number(calendarMatch[3] ?? 1);
            const localDate = new Date(0);
            localDate.setHours(0, 0, 0, 0);
            localDate.setFullYear(year, month - 1, day);

            return year >= 1
                && localDate.getFullYear() === year
                && localDate.getMonth() === month - 1
                && localDate.getDate() === day
                ? localDate
                : new Date(Number.NaN);
        })()
        : date instanceof Date
            ? new Date(date.getTime())
            : new Date(date);
    
    if (isNaN(safeDate.getTime())) {
        throw new Error('Invalid date provided to strftime');
    }

    // Date components
    const year = safeDate.getFullYear();
    const month = safeDate.getMonth() + 1;
    const day = safeDate.getDate();
    const hours24 = safeDate.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = safeDate.getMinutes();
    const seconds = safeDate.getSeconds();
    const ms = safeDate.getMilliseconds();
    const dayOfYear = Math.floor(
        (Date.UTC(year, safeDate.getMonth(), day) - Date.UTC(year, 0, 1)) / 86400000
    ) + 1;
    const isPM = hours24 >= 12;
    const firstDay = new Date(year, 0, 1).getDay();
    const firstSunday = (7 - firstDay) % 7;
    const firstMonday = (8 - firstDay) % 7;
    const dayIndex = dayOfYear - 1;
    const weekFrom = (firstWeekday: number) =>
        dayIndex < firstWeekday ? 0 : Math.floor((dayIndex - firstWeekday) / 7) + 1;

    // Timezone
    const timezoneOffset = safeDate.getTimezoneOffset();
    const absoluteTimezoneOffset = Math.abs(timezoneOffset);
    const tzHours = Math.floor(absoluteTimezoneOffset / 60);
    const tzMinutes = absoluteTimezoneOffset % 60;
    const tzSign = timezoneOffset > 0 ? '-' : '+';

    // Capitalization helper
    const formatText = (text: string, modifier: string): string => {
        switch (modifier) {
            case '^': return text.toUpperCase();
            case '_': return text.toLowerCase();
            default: return text[0].toUpperCase() + text.slice(1);
        }
    };

    // Locale text formatters
    const getText = (type: 'weekday'|'month', length: 'long'|'short', modifier: string = ''): string => {
        const text = safeDate.toLocaleString(locale, { [type]: length });
        return formatText(text, modifier);
    };

    const timezoneName = new Intl.DateTimeFormat(locale, { timeZoneName: "short" })
        .formatToParts(safeDate)
        .find((part) => part.type === "timeZoneName")?.value
        ?? safeDate.toTimeString().match(/\((.+)\)$/)?.[1]
        ?? "UTC";

    // Replacement mapping
    const baseReplacements: Record<string, string> = {
        '%Y': year.toString(),
        '%y': pad(year % 100),
        '%m': pad(month),
        '%d': pad(day),
        '%w': String(safeDate.getDay()),
        '%H': pad(hours24),
        '%I': pad(hours12),
        '%M': pad(minutes),
        '%S': pad(seconds),
        '%f': pad(ms, 3) + '000',
        '%p': isPM ? 'PM' : 'AM',
        '%j': pad(dayOfYear, 3),
        '%U': pad(weekFrom(firstSunday)),
        '%W': pad(weekFrom(firstMonday)),
        '%c': safeDate.toLocaleString(locale),
        '%x': safeDate.toLocaleDateString(locale),
        '%X': safeDate.toLocaleTimeString(locale),
        '%Z': timezoneName,
        '%z': `${tzSign}${pad(tzHours)}${pad(tzMinutes)}`,
        '%s': Math.floor(safeDate.getTime() / 1000).toString(),
        '%%': '%'
    };

    return format.replace(
        /%(\^|_)?([AaBb])|%[YymdwHIMSpfjUWcxXZzs%]/g,
        (match, modifier, textCode) => {
            if (!textCode) return baseReplacements[match] ?? match;

            const type = textCode === 'A' || textCode === 'a' ? 'weekday' : 'month';
            const length = textCode === 'A' || textCode === 'B' ? 'long' : 'short';
            return getText(type, length, modifier);
        }
    );
}


export function delayedClass(
  node: Element,
  params: { className: string; delay: number; condition: boolean }
): { update: (newParams: { condition: boolean }) => void; destroy: () => void } {
  let timeoutId: number | null = null;
    
  function update(condition: boolean) {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Remove the class immediately if condition is false
    node.classList.remove(params.className);

    // Add the class after delay if condition is true
    if (condition) {
      timeoutId = window.setTimeout(() => {
        node.classList.add(params.className);
      }, params.delay);
    }
  }

  // Initialize with the current condition
  update(params.condition);

  return {
    update(newParams: { condition: boolean }) {
      update(newParams.condition);
    },
    destroy() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      node.classList.remove(params.className);
    }
  };
}

export function slugify(str: string): string {
    let result = '';
    let prevDash = false;

    str = str.normalize('NFC').toLowerCase().trim();

    for (let i = 0; i < str.length; i++) {
        const code = str.codePointAt(i)!;

        if (code > 0xffff) i++;

        // Unicode letter or number
        if (
            (code >= 48 && code <= 57) || // 0-9
            (code >= 97 && code <= 122) || // a-z
            (code >= 0x00c0 && code <= 0x02af) || // Latin extended
            (code >= 0x0370 && code <= 0x1fff) || // Greek, Cyrillic, Armenian, Hebrew, Arabic, etc.
            (code >= 0x2000 && code <= 0x206f) === false && // Exclude punctuation range
            /\p{L}|\p{N}/u.test(String.fromCodePoint(code)) // Full Unicode letter/number fallback
        ) {
            result += String.fromCodePoint(code);
            prevDash = false;
        } else {
            if (!prevDash && result.length > 0) {
                result += '-';
                prevDash = true;
            }
        }
    }

    if (result.endsWith('-')) {
        result = result.slice(0, -1);
    }

    return result;
}

/**
 * Generates a readable random passphrase made of pseudo-words separated by hyphens.
 *
 * The passphrase is generated using cryptographically secure random values and is
 * exactly `length` characters long, including separators. Word lengths are balanced
 * as evenly as possible to keep it easy to read and retain.
 *
 * @param length - Desired passphrase length, including hyphens. Defaults to `12`.
 * @returns A readable random passphrase in a `word-word-word` style.
**/
export function generatePassphrase(length: number = 12) {
    const C = "bcdfghjklmnprstvwz";
    const V = "aeiou";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);

    const words = Math.max(1, Math.round((length + 1) / 7)); // ~6-char words
    const letters = length - words + 1;
    const base = Math.floor(letters / words);
    const extra = letters % words;

    let p = "", k = 0;

    for (let w = 0; w < words; w++) {
        if (w) p += "-";

        for (let i = 0, n = base + Number(w < extra); i < n; i++, k++) {
        const chars = i % 2 ? V : C;
        p += chars[bytes[k] % chars.length];
        }
    }

    return p;
}
