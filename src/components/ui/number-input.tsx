import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";

type EmptyBehavior = "preserve" | "null" | "fallback";

export interface NumberInputProps
  extends Omit<InputProps, "type" | "value" | "defaultValue" | "onChange"> {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  emptyBehavior?: EmptyBehavior;
  fallbackValue?: number;
  ref?: React.Ref<HTMLInputElement>;
}

function formatNumberValue(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function isTransientNumberInput(value: string): boolean {
  return value === "" || value === "-" || value === "." || value === "-.";
}

function parseNumberValue(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function NumberInput({
  value,
  onValueChange,
  emptyBehavior = "preserve",
  fallbackValue,
  onBlur,
  onFocus,
  ref,
  ...props
}: NumberInputProps) {
  const [draft, setDraft] = React.useState(() => formatNumberValue(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) {
      setDraft(formatNumberValue(value));
    }
  }, [value, focused]);

  return (
    <Input
      {...props}
      ref={ref}
      type="number"
      value={draft}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);

        if (isTransientNumberInput(nextValue)) {
          if (nextValue === "" && emptyBehavior === "null") {
            onValueChange(null);
          }
          return;
        }

        const parsed = parseNumberValue(nextValue);
        if (parsed !== null) {
          onValueChange(parsed);
        }
      }}
      onBlur={(event) => {
        setFocused(false);
        const nextValue = event.target.value.trim();

        if (nextValue === "") {
          if (emptyBehavior === "null") {
            onValueChange(null);
            setDraft("");
          } else if (
            emptyBehavior === "fallback" &&
            typeof fallbackValue === "number"
          ) {
            onValueChange(fallbackValue);
            setDraft(formatNumberValue(fallbackValue));
          } else {
            setDraft(formatNumberValue(value));
          }

          onBlur?.(event);
          return;
        }

        const parsed = parseNumberValue(nextValue);
        if (parsed === null) {
          setDraft(formatNumberValue(value));
          onBlur?.(event);
          return;
        }

        onValueChange(parsed);
        setDraft(formatNumberValue(parsed));
        onBlur?.(event);
      }}
    />
  );
}

export { NumberInput };
