'use client';

import { createContext, useContext } from 'react';

const CspNonceContext = createContext('');

export function CspNonceProvider({
    children,
    nonce,
}: {
    children: React.ReactNode;
    nonce: string;
}) {
    return (
        <CspNonceContext.Provider value={nonce}>
            {children}
        </CspNonceContext.Provider>
    );
}

export function useCspNonce(): string {
    return useContext(CspNonceContext);
}

export function NoncedStyle({ css }: { css: string }) {
    const nonce = useCspNonce();

    return (
        <style
            nonce={nonce || undefined}
            dangerouslySetInnerHTML={{ __html: css }}
        />
    );
}
