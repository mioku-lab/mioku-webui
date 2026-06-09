import * as React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./button-variants";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  ref?: React.Ref<HTMLButtonElement>;
}

function Button({ className, variant, size, ref, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
}

export { Button };
