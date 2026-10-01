export type TokenParamType = "number" | "text";

export type TokenParam = {
  id: string;
  label: string;
  type: TokenParamType;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: string;
  required?: boolean;
};

export type TokenDefinition = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  params?: TokenParam[];
  insertText: string | ((params: Record<string, string>) => string);
};

const toInt = (value: string, fallback: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  const fallbackParsed = Number.parseInt(fallback, 10);
  return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
};

const formatRange = (
  minValue: string,
  maxValue: string,
  fallbackMin: string,
  fallbackMax: string
): string => {
  const min = toInt(minValue, fallbackMin);
  const max = toInt(maxValue, fallbackMax);
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return `${low},${high}`;
};

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const DEFAULT_TOKENS: TokenDefinition[] = [
  {
    id: "upper_exact",
    label: "Uppercase letters (exactly N)",
    description: "Insert [A-Z]{N}",
    keywords: ["upper", "letters", "exact"],
    params: [
      {
        id: "count",
        label: "N",
        type: "number",
        min: 1,
        step: 1,
        defaultValue: "1",
        required: true
      }
    ],
    insertText: ({ count }) => `[A-Z]{${toInt(count ?? "", "1")}}`
  },
  {
    id: "lower_exact",
    label: "Lowercase letters (exactly N)",
    description: "Insert [a-z]{N}",
    keywords: ["lower", "letters", "exact"],
    params: [
      {
        id: "count",
        label: "N",
        type: "number",
        min: 1,
        step: 1,
        defaultValue: "1",
        required: true
      }
    ],
    insertText: ({ count }) => `[a-z]{${toInt(count ?? "", "1")}}`
  },
  {
    id: "digits_exact",
    label: "Digits (exactly N)",
    description: "Insert \\d{N}",
    keywords: ["digits", "numbers", "exact"],
    params: [
      {
        id: "count",
        label: "N",
        type: "number",
        min: 1,
        step: 1,
        defaultValue: "1",
        required: true
      }
    ],
    insertText: ({ count }) => `\\d{${toInt(count ?? "", "1")}}`
  },
  {
    id: "alnum_range",
    label: "Alphanumeric length range",
    description: "Insert [A-Za-z0-9]{min,max}",
    keywords: ["alphanumeric", "range", "length"],
    params: [
      {
        id: "min",
        label: "Min",
        type: "number",
        min: 0,
        step: 1,
        defaultValue: "1",
        required: true
      },
      {
        id: "max",
        label: "Max",
        type: "number",
        min: 1,
        step: 1,
        defaultValue: "5",
        required: true
      }
    ],
    insertText: ({ min, max }) =>
      `[A-Za-z0-9]{${formatRange(min ?? "", max ?? "", "1", "5")}}`
  },
  {
    id: "any_range",
    label: "Any char length range",
    description: "Insert .{min,max}",
    keywords: ["any", "range", "length"],
    params: [
      {
        id: "min",
        label: "Min",
        type: "number",
        min: 0,
        step: 1,
        defaultValue: "1",
        required: true
      },
      {
        id: "max",
        label: "Max",
        type: "number",
        min: 1,
        step: 1,
        defaultValue: "5",
        required: true
      }
    ],
    insertText: ({ min, max }) =>
      `.{${formatRange(min ?? "", max ?? "", "1", "5")}}`
  },
  {
    id: "starts_with",
    label: "Starts with ...",
    description: "Insert ^LITERAL",
    keywords: ["starts", "prefix", "literal"],
    params: [
      {
        id: "text",
        label: "Literal text",
        type: "text",
        placeholder: "ABC",
        defaultValue: "",
        required: true
      }
    ],
    insertText: ({ text }) => `^${escapeRegex(text ?? "")}`
  },
  {
    id: "ends_with",
    label: "Ends with ...",
    description: "Insert LITERAL$",
    keywords: ["ends", "suffix", "literal"],
    params: [
      {
        id: "text",
        label: "Literal text",
        type: "text",
        placeholder: "XYZ",
        defaultValue: "",
        required: true
      }
    ],
    insertText: ({ text }) => `${escapeRegex(text ?? "")}$`
  }
];

const formatCountPrefix = (value: string | undefined, fallback: string) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 1) return String(parsed);
  const fallbackParsed = Number.parseInt(fallback, 10);
  if (Number.isFinite(fallbackParsed) && fallbackParsed > 1) return String(fallbackParsed);
  return "";
};

export const GENERATOR_TOKENS: TokenDefinition[] = [
  {
    id: "seq_num",
    label: "Sequential number (N)",
    description: "Insert %N% or %3N%",
    keywords: ["sequence", "number", "id"],
    params: [
      { id: "digits", label: "Digits", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ digits }) => `%${formatCountPrefix(digits, "1")}N%`
  },
  {
    id: "today_num",
    label: "Today counter (Ntod)",
    description: "Insert %Ntod% or %3Ntod%",
    keywords: ["today", "counter"],
    params: [
      { id: "digits", label: "Digits", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ digits }) => `%${formatCountPrefix(digits, "1")}Ntod%`
  },
  {
    id: "date_fmt",
    label: "Date (D<fmt>)",
    description: "Insert %D<Y-m-d>%",
    keywords: ["date", "format"],
    params: [
      {
        id: "format",
        label: "Format",
        type: "text",
        placeholder: "Y-m-d",
        defaultValue: "Y-m-d",
        required: true
      }
    ],
    insertText: ({ format }) => `%D<${format ?? "Y-m-d"}>%`
  },
  {
    id: "random_any",
    label: "Random letters+numbers (R)",
    description: "Insert %R% or %4R%",
    keywords: ["random", "alnum"],
    params: [
      { id: "length", label: "Length", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ length }) => `%${formatCountPrefix(length, "1")}R%`
  },
  {
    id: "random_lower",
    label: "Random lowercase letters (_R)",
    description: "Insert %_R% or %4_R%",
    keywords: ["random", "lowercase"],
    params: [
      { id: "length", label: "Length", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ length }) => `%${formatCountPrefix(length, "1")}_R%`
  },
  {
    id: "random_upper",
    label: "Random uppercase letters (^R)",
    description: "Insert %^R% or %4^R%",
    keywords: ["random", "uppercase"],
    params: [
      { id: "length", label: "Length", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ length }) => `%${formatCountPrefix(length, "1")}^R%`
  },
  {
    id: "random_letters",
    label: "Random letters (Rl)",
    description: "Insert %Rl% or %4Rl%",
    keywords: ["random", "letters"],
    params: [
      { id: "length", label: "Length", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ length }) => `%${formatCountPrefix(length, "1")}Rl%`
  },
  {
    id: "random_letters_lower",
    label: "Random lowercase letters (_Rl)",
    description: "Insert %_Rl% or %4_Rl%",
    keywords: ["random", "letters", "lowercase"],
    params: [
      { id: "length", label: "Length", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ length }) => `%${formatCountPrefix(length, "1")}_Rl%`
  },
  {
    id: "random_letters_upper",
    label: "Random uppercase letters (^Rl)",
    description: "Insert %^Rl% or %4^Rl%",
    keywords: ["random", "letters", "uppercase"],
    params: [
      { id: "length", label: "Length", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ length }) => `%${formatCountPrefix(length, "1")}^Rl%`
  },
  {
    id: "random_numbers",
    label: "Random numbers (Rn)",
    description: "Insert %Rn% or %4Rn%",
    keywords: ["random", "numbers"],
    params: [
      { id: "length", label: "Length", type: "number", min: 1, step: 1, defaultValue: "1" }
    ],
    insertText: ({ length }) => `%${formatCountPrefix(length, "1")}Rn%`
  }
];

const generatorTagPatterns: RegExp[] = [
  /^(\d*)?N$/,
  /^(\d*)?Ntod$/,
  /^D<.+>$/,
  /^(\d*)?[_^]?R$/,
  /^(\d*)?[_^]?Rl$/,
  /^(\d*)?Rn$/
];

export const validateGeneratorTemplate = (template: string): boolean => {
  const tagRegex = /%([^%]+)%/g;
  const tags: string[] = [];
  let cleaned = template;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(template))) {
    tags.push(match[1]);
    cleaned = cleaned.replace(match[0], "");
  }
  if (cleaned.includes("%")) return false;
  return tags.every((tag) => generatorTagPatterns.some((pattern) => pattern.test(tag)));
};
