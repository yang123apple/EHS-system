/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'glass' | 'clay'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-xl text-slate-950 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5",
    glass: "rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl text-slate-950 shadow-[0_8px_32px_0_rgba(31,38,135,0.12)] hover:shadow-[0_12px_48px_0_rgba(31,38,135,0.18)] transition-all duration-300 hover:-translate-y-1",
    clay: "rounded-3xl border-0 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30 text-slate-950 shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 hover:-translate-y-1"
  };
  
  return (
    <div
      ref={ref}
      className={cn(variants[variant], className)}
      {...props}
    />
  );
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 p-8", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight text-slate-900",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-slate-500", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-8 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-8 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Industrial Specific Card Components

const IndustrialCardHeader = ({
    icon: Icon,
    title,
    id,
    status,
    statusColor = "default"
}: {
    icon?: React.ElementType,
    title: string,
    id?: string,
    status?: string,
    statusColor?: "danger" | "warning" | "success" | "info" | "default"
}) => {
    return (
        <div className="flex items-start justify-between mb-4 border-b border-slate-50 pb-3">
             <div className="flex items-center gap-3">
                {Icon && (
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                        <Icon size={20} />
                    </div>
                )}
                <div>
                    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                    {id && <p className="text-xs font-mono text-slate-400 mt-0.5">{id}</p>}
                </div>
             </div>
             {status && (
                 <span className={cn(
                     "px-2.5 py-0.5 text-xs font-medium rounded-full border",
                     statusColor === "danger" && "bg-red-50 text-red-700 border-red-200",
                     statusColor === "warning" && "bg-orange-50 text-orange-700 border-orange-200",
                     statusColor === "success" && "bg-green-50 text-green-700 border-green-200",
                     statusColor === "info" && "bg-blue-50 text-blue-700 border-blue-200",
                     statusColor === "default" && "bg-slate-100 text-slate-600 border-slate-200"
                 )}>
                     {status}
                 </span>
             )}
        </div>
    )
}

const IndustrialCardField = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="mb-2">
        <span className="text-xs font-bold text-slate-400 block mb-0.5 uppercase tracking-wide">{label}</span>
        <div className="text-sm text-slate-700 font-medium">{value}</div>
    </div>
)

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, IndustrialCardHeader, IndustrialCardField }
