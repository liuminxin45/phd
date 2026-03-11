import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const glassPanelClass = 'glass-panel';
export const glassPanelStrongClass = 'glass-panel-strong';
export const glassToolbarClass = 'glass-toolbar';
export const glassInputClass = 'glass-input';
export const glassSectionClass = 'glass-section';
export const glassDotClass = 'glass-dot';
export const glassModalOverlayClass = 'glass-modal-overlay';
export const glassModalContentClass = 'glass-modal-content';

const glassIconButtonVariants = cva(
  'h-9 w-9 rounded-xl border border-white/45 bg-white/42 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/28 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/66 hover:text-slate-900 hover:shadow-[0_14px_30px_rgba(15,23,42,0.16)]',
  {
    variants: {
      tone: {
        neutral: '',
        primary: 'text-sky-700 hover:text-sky-900',
        warning: 'text-amber-700 hover:text-amber-900',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
);

export function GlassPage({
  className,
  children,
  showOrbs = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { showOrbs?: boolean }) {
  return (
    <div className={cn('glass-page min-h-full', className)} {...props}>
      {showOrbs && (
        <>
          <div className="glass-orb glass-orb-a" aria-hidden="true" />
          <div className="glass-orb glass-orb-b" aria-hidden="true" />
          <div className="glass-orb glass-orb-c" aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  );
}

export function GlassPanel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(glassPanelClass, className)} {...props}>{children}</div>;
}

export function GlassToolbar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(glassToolbarClass, className)} {...props}>{children}</div>;
}

export function GlassSection({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(glassSectionClass, className)} {...props}>{children}</div>;
}

export function GlassIconButton({
  className,
  tone,
  title,
  tooltip,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'variant' | 'size'> &
  VariantProps<typeof glassIconButtonVariants> & {
    tooltip?: React.ReactNode;
  }) {
  const tooltipContent = tooltip ?? (typeof title === 'string' ? title : undefined);
  const buttonNode = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(glassIconButtonVariants({ tone }), className)}
      title={undefined}
      {...props}
    />
  );

  if (!tooltipContent) return buttonNode;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{buttonNode}</TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}
