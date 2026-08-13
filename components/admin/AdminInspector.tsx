import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { AdminDrawer, type AdminDrawerProps } from './AdminOverlay';

type AdminInspectorBaseProps = {
    title: string;
    eyebrow?: string;
    description?: string;
    children: ReactNode;
    className?: string;
};

type AdminInspectorPanelProps = AdminInspectorBaseProps & {
    mode?: 'panel';
    onClose?: () => void;
};

type AdminInspectorDrawerProps = AdminInspectorBaseProps & {
    mode: 'drawer';
    open: boolean;
    onClose: () => void;
    footer?: ReactNode;
    drawerSide?: AdminDrawerProps['side'];
    drawerSize?: AdminDrawerProps['size'];
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
};

export type AdminInspectorProps = AdminInspectorPanelProps | AdminInspectorDrawerProps;

export default function AdminInspector(props: AdminInspectorProps) {
    if (props.mode === 'drawer') {
        return (
            <AdminDrawer
                open={props.open}
                onClose={props.onClose}
                title={props.title}
                eyebrow={props.eyebrow}
                description={props.description}
                footer={props.footer}
                side={props.drawerSide}
                size={props.drawerSize}
                closeOnBackdrop={props.closeOnBackdrop}
                closeOnEscape={props.closeOnEscape}
                className={props.className}
            >
                {props.children}
            </AdminDrawer>
        );
    }

    const { title, eyebrow, description, children, onClose, className = '' } = props;
    return (
        <section className={`border border-white/10 bg-white/[0.04] ${className}`} aria-label={`${title} details`}>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                    {eyebrow ? <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-amber-200">{eyebrow}</p> : null}
                    <h2 className="mt-1 truncate text-lg font-semibold text-white">{title}</h2>
                    {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
                </div>
                {onClose ? (
                    <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200" aria-label="Close record details">
                        <X size={16} />
                    </button>
                ) : null}
            </div>
            <div className="p-5">{children}</div>
        </section>
    );
}
