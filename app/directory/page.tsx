'use client';

import { useState, useEffect, useTransition } from 'react';
import useSWR from 'swr';
import { Search, Facebook, Linkedin, Users, Grid, List as ListIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const branches = ['All', 'OSR', 'SSC', 'College Councils'] as const;
type Branch = typeof branches[number];

interface Officer {
    id?: string;
    name: string;
    position: string;
    branch?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    priority?: number;
}

export default function DirectoryPage() {
    const { data: response, error, isLoading } = useSWR('/api/directory', (url: string) => fetch(url).then(res => res.json()));
    const officers: Officer[] = response?.data || [];

    const [search, setSearch] = useState('');
    const [filterQuery, setFilterQuery] = useState('');
    const [viewModeState, setViewModeState] = useState<'grid' | 'list'>('grid');
    const [userOverridden, setUserOverridden] = useState(false);
    const [activeBranch, setActiveBranch] = useState<Branch>('All');
    const [filterBranch, setFilterBranch] = useState<Branch>('All');
    const [isPending, startTransition] = useTransition();

    // Derive effective view mode: default to list if many people, unless user manually chose
    const viewMode = (!userOverridden && officers.length > 15) ? 'list' : viewModeState;

    const handleViewChange = (mode: 'grid' | 'list') => {
        setViewModeState(mode);
        setUserOverridden(true);
    };

    const filtered = officers.filter(o => {
        const matchSearch = o.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
            o.position.toLowerCase().includes(filterQuery.toLowerCase()) ||
            (o.branch || '').toLowerCase().includes(filterQuery.toLowerCase());
        const matchBranch = filterBranch === 'All' || (o.branch || '').toLowerCase().includes(filterBranch.toLowerCase());
        return matchSearch && matchBranch;
    });

    return (
        <>
            {/* Header — no motion, instant render */}
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <Users className="mx-auto mb-4 text-white/80" size={40} />
                    <h1 className="font-bold text-white mb-3">
                        Student Government <span className="text-gradient-gold">Directory</span>
                    </h1>
                    <p className="text-white/60 max-w-lg mx-auto">
                        Meet the student leaders serving across all branches of the RTU Student Government.
                    </p>
                </div>
            </section>

            {/* Branch Filter Tabs */}
            <section className="container-main -mt-6 mb-2">
                <div className="flex gap-2 justify-center flex-wrap">
                    {branches.map(branch => {
                        const isActive = activeBranch === branch;
                        return (
                            <button
                                key={branch}
                                onClick={() => {
                                    setActiveBranch(branch);
                                    startTransition(() => {
                                        setFilterBranch(branch);
                                    });
                                }}
                                className="relative px-5 py-2 rounded-full text-sm font-semibold cursor-pointer border-2 transition-colors"
                                style={{
                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                    borderColor: isActive ? 'transparent' : 'var(--glass-border)',
                                    background: isActive ? 'transparent' : 'var(--bg-card)',
                                }}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="active-branch"
                                        className="absolute inset-0 rounded-full"
                                        style={{ background: 'var(--rtu-blue)' }}
                                        transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                                    />
                                )}
                                <span className="relative z-10">{branch}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Search Bar & View Toggle */}
            < section className="container-main -mt-6" >
                <div className="card p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 bg-gray-50/50 rounded-lg p-2 border border-gray-100">
                        <Search size={20} style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search by name, position, or branch..."
                            className="flex-1 outline-none text-base bg-transparent"
                            style={{ color: 'var(--text-primary)' }}
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                startTransition(() => {
                                    setFilterQuery(e.target.value);
                                });
                            }}
                        />
                        {isPending && <Loader2 size={16} className="animate-spin text-amber-500" />}
                    </div>

                    {/* View Controls */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => handleViewChange('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-amber-500' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Grid View"
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => handleViewChange('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-amber-500' : 'text-gray-400 hover:text-gray-600'}`}
                            title="List View"
                        >
                            <ListIcon size={18} />
                        </button>
                    </div>
                </div>
            </section >

            {/* Grid */}
            < section className="section" >
                <div className="container-main">
                    {isLoading && (
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="card p-6 flex flex-col gap-4">
                                    <div className="skeleton w-16 h-16 rounded-full" />
                                    <div className="skeleton h-4 w-3/4" />
                                    <div className="skeleton h-3 w-1/2" />
                                    <div className="skeleton h-3 w-1/3" />
                                </div>
                            ))}
                        </div>
                    )}
                    {error && (
                        <p className="text-center text-red-500">Failed to load directory</p>
                    )}
                    {!isLoading && !error && filtered.length === 0 && (
                        <p className="text-center" style={{ color: 'var(--text-muted)' }}>
                            {search ? 'No officers found matching your search.' : 'No officers in the directory yet.'}
                        </p>
                    )}
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                        {filtered.map((officer, idx) => (
                            <div
                                key={officer.id || idx}
                                className={`card p-6 flex ${viewMode === 'list' ? 'flex-row items-center gap-6' : 'flex-col'} content-visibility-auto`}
                            >
                                {/* Avatar */}
                                <div
                                    className={`${viewMode === 'list' ? 'w-12 h-12 mb-0 shrink-0' : 'w-16 h-16 mb-4'} rounded-full flex items-center justify-center text-white font-bold text-xl`}
                                    style={{ background: 'linear-gradient(135deg, var(--rtu-blue), var(--rtu-blue-light))' }}
                                >
                                    {officer.name.charAt(0)}
                                </div>

                                <div className={viewMode === 'list' ? 'flex-1' : ''}>
                                    <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                        {officer.name}
                                    </h3>
                                    <p className="text-sm mb-1" style={{ color: 'var(--rtu-blue-light)' }}>
                                        {officer.position}
                                    </p>
                                    {officer.branch && viewMode === 'grid' && (
                                        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                                            {officer.branch}
                                        </p>
                                    )}
                                </div>

                                {/* List View specific Branch pill */}
                                {officer.branch && viewMode === 'list' && (
                                    <div className="hidden md:block px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-xs font-medium border border-gray-100 whitespace-nowrap">
                                        {officer.branch}
                                    </div>
                                )}

                                {/* Social Links */}
                                <div className={`flex gap-3 ${viewMode === 'grid' ? 'mt-auto' : 'ml-4 shrink-0'}`}>
                                    {officer.facebookUrl && (
                                        <a
                                            href={officer.facebookUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors p-2 hover:bg-gray-50 rounded-full"
                                            style={{ color: 'var(--text-muted)' }}
                                            title="Facebook Profile"
                                        >
                                            <Facebook size={18} />
                                        </a>
                                    )}
                                    {officer.linkedinUrl && (
                                        <a
                                            href={officer.linkedinUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors p-2 hover:bg-gray-50 rounded-full"
                                            style={{ color: 'var(--text-muted)' }}
                                            title="LinkedIn Profile"
                                        >
                                            <Linkedin size={18} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section >
        </>
    );
}
