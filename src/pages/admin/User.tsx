import { useState, useEffect } from 'preact/hooks'

type UserDetail = {
    id: string
    name: string
    email: string
    role: string
    status: string
    date: string
}

type RequestDetail = {
    id: string
    name: string
    email: string
    role: string
    date: string
}

const defaultActiveUsers: UserDetail[] = [
    {
        id: 'usr-01',
        name: 'John Doe',
        email: 'operator@gmail.com',
        role: 'Operator',
        status: 'Active',
        date: '2026-06-01'
    },
    {
        id: 'usr-02',
        name: 'Jane Smith',
        email: 'jane@gmail.com',
        role: 'Operator',
        status: 'Active',
        date: '2026-06-15'
    },
    {
        id: 'usr-03',
        name: 'J. Silva',
        email: 'jsilva@firemex.com',
        role: 'Administrator',
        status: 'Active',
        date: '2026-05-10'
    }
]

const defaultPendingRequests: RequestDetail[] = [
    {
        id: 'usr-101',
        name: 'Bob Johnson',
        email: 'bob@gmail.com',
        role: 'Operator',
        date: '2026-07-09'
    },
    {
        id: 'usr-102',
        name: 'Alice Williams',
        email: 'alice@gmail.com',
        role: 'Operator',
        date: '2026-07-10'
    }
]

export function User() {
    const [activeUsers, setActiveUsers] = useState<UserDetail[]>(() => {
        const saved = localStorage.getItem('firemex_active_users')
        return saved ? JSON.parse(saved) : defaultActiveUsers
    })

    const [pendingRequests, setPendingRequests] = useState<RequestDetail[]>(() => {
        const saved = localStorage.getItem('firemex_pending_users')
        return saved ? JSON.parse(saved) : defaultPendingRequests
    })

    const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active')

    // Persist active users
    useEffect(() => {
        localStorage.setItem('firemex_active_users', JSON.stringify(activeUsers))
    }, [activeUsers])

    // Persist pending requests
    useEffect(() => {
        localStorage.setItem('firemex_pending_users', JSON.stringify(pendingRequests))
    }, [pendingRequests])

    // Approve request handler
    const handleApprove = (req: RequestDetail) => {
        const newUser: UserDetail = {
            id: req.id,
            name: req.name,
            email: req.email,
            role: req.role,
            status: 'Active',
            date: new Date().toISOString().split('T')[0]
        }
        setActiveUsers([...activeUsers, newUser])
        setPendingRequests(pendingRequests.filter((r) => r.id !== req.id))
    }

    // Deny request handler
    const handleDeny = (id: string) => {
        setPendingRequests(pendingRequests.filter((r) => r.id !== id))
    }

    // Revoke active user handler
    const handleRevoke = (id: string) => {
        if (confirm('Are you sure you want to revoke access for this user?')) {
            setActiveUsers(activeUsers.filter((u) => u.id !== id))
        }
    }

    return (
        <div class="flex flex-col gap-6 w-full pb-8">
            {/* Page Header */}
            <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 bg-brand-surface border-b border-[#8B949E]/10 p-4 pl-10">
                <div>
                    <h1 class="text-2xl font-bold text-slate-100">User Management</h1>
                    <p class="text-sm text-[#8B949E] mt-1">Manage system operators & registration requests</p>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div class="flex items-center gap-4 border-b border-[#8B949E]/10 mx-10 pb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab('active')}
                    class={`relative pb-2 text-sm font-semibold transition-all ${activeTab === 'active'
                        ? 'text-accent border-b-2 border-accent'
                        : 'text-slate-400 hover:text-slate-200'
                        }`}
                >
                    Active Operators ({activeUsers.filter(u => u.role === 'Operator').length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('pending')}
                    class={`relative pb-2 text-sm font-semibold transition-all ${activeTab === 'pending'
                        ? 'text-accent border-b-2 border-accent'
                        : 'text-slate-400 hover:text-slate-200'
                        }`}
                >
                    Pending Requests ({pendingRequests.length})
                </button>
            </div>

            {/* Tab Content */}
            <div class="mx-10 mt-2">
                {activeTab === 'active' ? (
                    <div>
                        {/* Grid Layout for Active Operators */}
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeUsers
                                .filter((user) => user.role === 'Operator')
                                .map((user) => (
                                    <div
                                        key={user.id}
                                        class="bg-[#0B1315]/40 border border-[#8B949E]/10 rounded-3xl p-5 flex flex-col gap-4 relative group hover:border-[#8B949E]/20 transition-all"
                                    >
                                        <div class="flex items-center gap-4">
                                            {/* Avatar */}
                                            <div class="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center font-bold text-teal-400 text-lg uppercase">
                                                {user.name.split(' ').map((n) => n[0]).join('')}
                                            </div>

                                            {/* Detail Summary */}
                                            <div class="flex flex-col">
                                                <span class="text-base font-bold text-slate-100">{user.name}</span>
                                                <span class="text-xs text-slate-400 font-mono mt-0.5">{user.email}</span>
                                            </div>
                                        </div>

                                        <hr class="border-[#8B949E]/10 my-1" />

                                        {/* Details */}
                                        <div class="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <span class="text-slate-500 font-mono block mb-1">System Role</span>
                                                <span class="inline-flex items-center gap-1 border border-accent/20 bg-accent/5 px-2 py-0.5 rounded text-[10px] font-bold text-accent uppercase tracking-wider">
                                                    {user.role}
                                                </span>
                                            </div>
                                            <div>
                                                <span class="text-slate-500 font-mono block mb-1">Status</span>
                                                <span class="flex items-center gap-1.5 font-semibold text-emerald-400">
                                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    {user.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-4 text-xs mt-1">
                                            <div>
                                                <span class="text-slate-500 font-mono block mb-1">Joined Date</span>
                                                <span class="font-mono text-slate-300">{user.date}</span>
                                            </div>
                                            <div class="flex items-end justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRevoke(user.id)}
                                                    class="text-xs font-semibold text-red-400 hover:text-red-500 transition-colors"
                                                >
                                                    Revoke Access
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {activeUsers.filter((user) => user.role === 'Operator').length === 0 && (
                            <div class="flex flex-col items-center justify-center p-12 bg-[#0B1315]/20 border border-dashed border-[#8B949E]/10 rounded-3xl text-center text-slate-500">
                                <p class="font-semibold text-lg text-slate-400 mb-1">No Active Operators</p>
                                <p class="text-sm">Approve new registration requests to add system operators.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        {/* Grid Layout for Pending Requests */}
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingRequests.map((req) => (
                                <div
                                    key={req.id}
                                    class="bg-[#0B1315]/40 border border-[#8B949E]/10 rounded-3xl p-5 flex flex-col gap-4 relative group hover:border-[#8B949E]/20 transition-all"
                                >
                                    <div class="flex items-center gap-4">
                                        {/* Avatar */}
                                        <div class="w-12 h-12 rounded-full bg-slate-500/10 border border-slate-500/30 flex items-center justify-center font-bold text-slate-400 text-lg uppercase">
                                            {req.name.split(' ').map((n) => n[0]).join('')}
                                        </div>

                                        {/* Detail Summary */}
                                        <div class="flex flex-col">
                                            <span class="text-base font-bold text-slate-100">{req.name}</span>
                                            <span class="text-xs text-slate-400 font-mono mt-0.5">{req.email}</span>
                                        </div>
                                    </div>

                                    <hr class="border-[#8B949E]/10 my-1" />

                                    {/* Request Info */}
                                    <div class="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span class="text-slate-500 font-mono block mb-1">Requested Role</span>
                                            <span class="inline-flex items-center gap-1 border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 rounded text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                                                {req.role}
                                            </span>
                                        </div>
                                        <div>
                                            <span class="text-slate-500 font-mono block mb-1">Requested Date</span>
                                            <span class="font-mono text-slate-300">{req.date}</span>
                                        </div>
                                    </div>

                                    <hr class="border-[#8B949E]/10 my-1" />

                                    {/* Action Buttons */}
                                    <div class="flex items-center justify-between gap-4 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => handleDeny(req.id)}
                                            class="flex-1 py-2 border border-red-500/30 hover:border-red-500/50 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-bold text-xs rounded-xl transition-all text-center"
                                        >
                                            Deny Request
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleApprove(req)}
                                            class="flex-1 py-2 border border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs rounded-xl transition-all text-center"
                                        >
                                            Approve Access
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {pendingRequests.length === 0 && (
                            <div class="flex flex-col items-center justify-center p-12 bg-[#0B1315]/20 border border-dashed border-[#8B949E]/10 rounded-3xl text-center text-slate-500">
                                <p class="font-semibold text-lg text-slate-400 mb-1">No Pending Requests</p>
                                <p class="text-sm">Access requests from new users will show up here.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
