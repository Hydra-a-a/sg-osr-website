import { DefaultSession } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
    interface Session {
        user: {
            role?: string;
            isDevSim?: boolean;
        } & DefaultSession['user'];
    }
}

declare module 'next-auth/jwt' {
    interface JWT extends DefaultJWT {
        role?: string;
        email?: string;
        accessToken?: string;
        accessTokenExpires?: number;
        refreshToken?: string;
        authAccessSessionVersion?: number;
        isDevSim?: boolean;
    }
}
