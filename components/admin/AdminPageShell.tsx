import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type AdminPageShellProps = {
    eyebrow: string;
    title: string;
    description: string;
    icon: LucideIcon;
    children: ReactNode;
    actions?: ReactNode;
    backLabel?: string;
    backHref?: string;
};

type AdminPanelProps = {
    children: ReactNode;
    className?: string;
    as?: 'div' | 'section' | 'article';
    ariaLabelledBy?: string;
};

type AdminNoticeProps = {
    children: ReactNode;
    tone?: 'info' | 'success' | 'warning' | 'danger';
    role?: 'alert' | 'status';
};

function cx(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(' ');
}

const noticeTones = {
    info: 'border-sky-300/25 bg-sky-300/10 text-sky-100',
    success: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    warning: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
    danger: 'border-red-300/25 bg-red-300/10 text-red-100',
} as const;

export function AdminPageShell({
    eyebrow,
    title,
    description,
    icon: Icon,
    children,
    actions,
    backLabel = 'Back to Operations Deck',
    backHref = '/services/admin',
}: AdminPageShellProps) {
    return (
        <section className="min-w-0 text-slate-100">
            <div className="mx-auto max-w-[1600px]">
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        {backLabel}
                    </Link>

                    <header className="mt-5 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-amber-100">
                                <Icon size={14} aria-hidden="true" />
                                {eyebrow}
                            </div>
                            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.02em] text-white md:text-4xl">{title}</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
                        </div>
                        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
                    </header>

                    {children}
            </div>
        </section>
    );
}

export function AdminPanel({ children, className, as = 'section', ariaLabelledBy }: AdminPanelProps) {
    const Tag = as;
    return (
        <Tag aria-labelledby={ariaLabelledBy} className={cx('border border-white/10 bg-white/[0.04] shadow-[0_12px_36px_rgba(0,0,0,0.2)]', className)}>
            {children}
        </Tag>
    );
}

export function AdminNotice({ children, tone = 'info', role = 'status' }: AdminNoticeProps) {
    return (
        <div className={cx('border px-4 py-3 text-sm leading-relaxed', noticeTones[tone])} role={role}>
            {children}
        </div>
    );
}

export function AdminActionButton({
    children,
    className,
    disabled,
    onClick,
    type = 'button',
}: {
    children: ReactNode;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit';
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={cx(
                'inline-flex min-h-11 items-center justify-center gap-2 border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                className,
            )}
        >
            {children}
        </button>
    );
}
