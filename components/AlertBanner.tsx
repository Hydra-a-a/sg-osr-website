'use client';

import { Megaphone, X } from 'lucide-react';
import { useState } from 'react';

interface AlertBannerProps {
    message: string;
}

export default function AlertBanner({ message }: AlertBannerProps) {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className="alert-banner alert-banner-visible py-2 px-4 relative z-[101] flex items-center justify-center gap-3 overflow-hidden">
                    <Megaphone size={16} className="flex-shrink-0 animate-bounce" />
                    <p className="text-sm font-bold text-center pr-8">
                        {message}
                    </p>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="absolute right-2 p-1 hover:bg-black/5 rounded-full transition-colors"
                        aria-label="Close alert"
                    >
                        <X size={16} />
                    </button>
        </div>
    );
}
