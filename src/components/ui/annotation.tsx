import * as React from "react";
import { cn } from "@/lib/utils";

/** Note éditoriale en Courier Prime — réservée aux annotations courtes. */
function Annotation({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="annotation"
      className={cn("font-annotation text-sm text-pen-strong", className)}
      {...props}
    />
  );
}

export { Annotation };
