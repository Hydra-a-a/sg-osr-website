import { NextResponse } from 'next/server';
import { getAuthorizedUsers } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const users = await getAuthorizedUsers();
        
        // Convert Map to array of objects for JSON serialization
        const userList = Array.from(users.entries()).map(([email, data]) => ({
            email,
            role: data.role,
            rowIndex: data.rowIndex,
            lastAccessColumnLetter: data.lastAccessColumnLetter
        }));

        const specificUser = users.get('2023-100433@rtu.edu.ph') || 'NOT_FOUND';

        return NextResponse.json({ 
            status: 'success', 
            specificUserSearch: {
                email: '2023-100433@rtu.edu.ph',
                result: specificUser
            },
            totalUsers: userList.length,
            users: userList 
        });
    } catch (error) {
        return NextResponse.json({ 
            status: 'error', 
            message: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
