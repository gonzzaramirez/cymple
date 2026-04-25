import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border-0 bg-clip-padding text-[15px] leading-normal font-medium tracking-normal whitespace-nowrap transition-all outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/35 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "rounded-lg bg-primary px-5 py-[11px] text-primary-foreground shadow-button-inset hover:bg-[var(--color-primary-600)]",
        secondary:
          "rounded-lg bg-secondary px-5 py-[11px] text-secondary-foreground shadow-none hover:bg-secondary/85",
        outline:
          "rounded-lg border border-border bg-transparent px-5 py-[11px] text-foreground shadow-none hover:bg-muted/80",
        ghost:
          "rounded-full px-4 py-2 text-[14px] text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
        destructive:
          "rounded-lg bg-destructive px-5 py-[11px] text-white shadow-button-inset hover:bg-destructive/90",
        link: "rounded-none px-0 py-0 text-primary underline-offset-4 hover:underline",
        dark:
          "rounded-lg bg-[#181e25] px-5 py-[11px] text-white shadow-button-inset hover:bg-[#181e25]/90 dark:bg-[#27272a] dark:hover:bg-[#27272a]/90",
      },
      size: {
        default: "h-11 gap-2 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-lg px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-lg px-4 text-[13px] font-semibold [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 rounded-lg px-8 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11 rounded-full p-0",
        "icon-xs": "size-7 rounded-full p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-full p-0",
        "icon-lg": "size-12 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
