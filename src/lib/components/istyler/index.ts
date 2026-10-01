import TextInput from './TextInput.svelte'
import FileInput from './FileInput.svelte'
import PasswordInput from './PasswordInput.svelte'
import NumberInput from './NumberInput.svelte'
import Select from './Select.svelte'
import Checkbox from './Checkbox.svelte'
import Radio from './Radio.svelte'
import Button from './Button.svelte'
import RangeInput from './Range.svelte'
import RangeValueInput from './RangeValueInput.svelte'
import DateInput from './Date.svelte'
import DateFormatInput from './DateFormatInput.svelte'
import Textarea from './Textarea.svelte'
import DynamicGroup from './DynamicGroup.svelte'
import PatternInput from './PatternInput.svelte'
import IconPicker from './IconPicker.svelte'
import ColorPicker from './ColorPicker.svelte'
import PinCodeInput from './PinCodeInput.svelte'

export {
  TextInput,
  FileInput,
  PasswordInput,
  NumberInput,
  Select,
  Checkbox,
  Radio,
  Button,
  RangeInput,
  RangeValueInput,
  DateInput,
  DateFormatInput,
  Textarea,
  DynamicGroup,
  PatternInput,
  IconPicker,
  ColorPicker,
  PinCodeInput,
}
export type { TokenDefinition, TokenParam } from './PatternInput.types'
export { DEFAULT_TOKENS } from './PatternInput.types'
export { GENERATOR_TOKENS, validateGeneratorTemplate } from './PatternInput.types'
export {
  DATE_FORMAT_PRESETS,
  DATE_FORMAT_TOKENS,
  IDENTIFIER_DATE_FORMAT_PRESETS,
  IDENTIFIER_DATE_FORMAT_TOKEN_CODES,
  dateFieldFormatPresets,
  dateFieldFormatTokenCodes,
  validateDateFormat,
} from './dateFormat'
export type { DateFormatPreset, DateFormatToken } from './dateFormat'

export const inputTypesMapping = {
  text: TextInput,
  password: PasswordInput,
  number: NumberInput,
  select: Select,
  checkbox: Checkbox,
  radio: Radio,
  range: RangeInput,
  date: DateInput,
  textarea: Textarea,
  dynamicgroup: DynamicGroup,
  iconpicker: IconPicker,
} as const;

export type InputType = keyof typeof inputTypesMapping;
export type InputComponent = typeof inputTypesMapping[InputType];
