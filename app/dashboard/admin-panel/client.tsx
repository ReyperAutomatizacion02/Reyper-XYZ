"use client";

import { useState, useTransition } from "react";
import {
    Users,
    UserCheck,
    UserX,
    Shield,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Check
} from "lucide-react";
import { approveUser, rejectUser, updateUserRoles } from "./actions";

const ROLES = [
    { value: "admin", label: "Administrador", color: "bg-red-500" },
    { value: "administracion", label: "Administración", color: "bg-blue-500" },
    { value: "recursos_humanos", label: "Recursos Humanos", color: "bg-purple-500" },
    { value: "contabilidad", label: "Contabilidad", color: "bg-green-500" },
    { value: "compras", label: "Compras", color: "bg-orange-500" },
    { value: "ventas", label: "Ventas", color: "bg-cyan-500" },
    { value: "automatizacion", label: "Automatización", color: "bg-pink-500" },
    { value: "diseno", label: "Diseño", color: "bg-indigo-500" },
    { value: "produccion", label: "Producción", color: "bg-yellow-500" },
    { value: "operador", label: "Operador", color: "bg-black" },
    { value: "calidad", label: "Calidad", color: "bg-teal-500" },
    { value: "almacen", label: "Almacén", color: "bg-amber-500" },
] as const;

type UserProfile = {
    id: string;
    full_name: string | null;
    username: string | null;
    roles: string[];
    is_approved: boolean;
    operator_name: string | null;
    created_at: string;
    updated_at: string;
};

interface AdminPanelClientProps {
    pendingUsers: UserProfile[];
    approvedUsers: UserProfile[];
    currentUserId: string;
}

// Multi-select checkbox component for roles
function RolesSelector({
    selectedRoles,
    onChange,
    disabled = false
}: {
    selectedRoles: string[],
    onChange: (roles: string[]) => void,
    disabled?: boolean
}) {
    const toggleRole = (roleValue: string) => {
        if (selectedRoles.includes(roleValue)) {
            onChange(selectedRoles.filter(r => r !== roleValue));
        } else {
            onChange([...selectedRoles, roleValue]);
        }
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ROLES.map(role => (
                <label
                    key={role.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${selectedRoles.includes(role.value)
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-primary/50 text-muted-foreground'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        disabled={disabled}
                        className="sr-only"
                    />
                    <div className={`w-3 h-3 rounded-sm flex items-center justify-center ${selectedRoles.includes(role.value) ? role.color : 'bg-muted'
                        }`}>
                        {selectedRoles.includes(role.value) && (
                            <Check className="w-2 h-2 text-white" />
                        )}
                    </div>
                    <span className="truncate">{role.label}</span>
                </label>
            ))}
        </div>
    );
}

export function AdminPanelClient({ pendingUsers, approvedUsers, currentUserId }: AdminPanelClientProps) {
    const [isPending, startTransition] = useTransition();
    const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>({});
    const [operatorNames, setOperatorNames] = useState<Record<string, string>>({});
    const [editingUser, setEditingUser] = useState<string | null>(null);

    const handleApprove = (userId: string) => {
        const roles = selectedRoles[userId] || ["produccion"];
        if (roles.length === 0) {
            alert("Debe seleccionar al menos un rol");
            return;
        }
        startTransition(async () => {
            try {
                const operatorName = operatorNames[userId];
                await approveUser(userId, roles, operatorName);
            } catch (error: any) {
                console.error(error);
                alert(error.message || "Error al aprobar usuario");
            }
        });
    };

    const handleReject = (userId: string) => {
        if (!confirm("¿Estás seguro de rechazar este usuario? Esta acción no se puede deshacer.")) return;
        startTransition(async () => {
            try {
                await rejectUser(userId);
            } catch (error) {
                console.error(error);
                alert("Error al rechazar usuario");
            }
        });
    };

    const handleUpdateRoles = (userId: string) => {
        const roles = selectedRoles[userId];
        if (!roles || roles.length === 0) {
            alert("Debe seleccionar al menos un rol");
            return;
        }
        startTransition(async () => {
            try {
                const operatorName = operatorNames[userId];
                await updateUserRoles(userId, roles, operatorName);
                setEditingUser(null);
            } catch (error: any) {
                console.error(error);
                alert(error.message || "Error al actualizar roles");
            }
        });
    };

    const getRoleLabels = (roles: string[]) => {
        return roles?.map(r => ROLES.find(role => role.value === r)?.label || r).join(", ") || "Sin roles";
    };

    const getRoleBadges = (roles: string[]) => {
        return roles?.slice(0, 3).map(r => {
            const role = ROLES.find(role => role.value === r);
            return (
                <span
                    key={r}
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${role?.color || 'bg-muted'} text-white`}
                >
                    {role?.label || r}
                </span>
            );
        }) || null;
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                    <Shield className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Panel de Administración</h1>
                    <p className="text-muted-foreground">Gestiona usuarios y asigna múltiples roles</p>
                </div>
            </div>

            {/* Pending Users Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <h2 className="text-lg font-semibold">Usuarios Pendientes</h2>
                    {pendingUsers.length > 0 && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500/10 text-orange-500">
                            {pendingUsers.length}
                        </span>
                    )}
                </div>

                {pendingUsers.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/20">
                        <UserCheck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-muted-foreground">No hay usuarios pendientes</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {pendingUsers.map(user => (
                            <div
                                key={user.id}
                                className="p-4 rounded-xl border border-border bg-card"
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <p className="font-semibold">{user.full_name || "Sin nombre"}</p>
                                        <p className="text-sm text-muted-foreground">@{user.username || "sin-usuario"}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Registrado: {new Date(user.created_at).toLocaleDateString('es-MX', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-sm font-medium mb-2">Seleccionar Roles:</p>
                                    <RolesSelector
                                        selectedRoles={selectedRoles[user.id] || ["produccion"]}
                                        onChange={(roles) => setSelectedRoles(prev => ({ ...prev, [user.id]: roles }))}
                                        disabled={isPending}
                                    />
                                </div>

                                {(selectedRoles[user.id] || ["produccion"]).includes("operador") && (
                                    <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="text-sm font-medium mb-2 block">Nombre del Operador (debe coincidir con Planeación):</label>
                                        <input
                                            type="text"
                                            value={operatorNames[user.id] || ""}
                                            onChange={(e) => setOperatorNames(prev => ({ ...prev, [user.id]: e.target.value.toUpperCase() }))}
                                            placeholder="EJ: JUAN PEREZ"
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            disabled={isPending}
                                        />
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleApprove(user.id)}
                                        disabled={isPending}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                                    >
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        Aprobar
                                    </button>
                                    <button
                                        onClick={() => handleReject(user.id)}
                                        disabled={isPending}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                        Rechazar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Approved Users Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Usuarios Activos</h2>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary">
                        {approvedUsers.length}
                    </span>
                </div>

                <div className="grid gap-4">
                    {approvedUsers.map(user => (
                        <div
                            key={user.id}
                            className="p-4 rounded-xl border border-border bg-card"
                        >
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold">{user.full_name || "Sin nombre"}</p>
                                        {user.id === currentUserId && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Tú</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(user.updated_at).toLocaleDateString('es-MX', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>

                            {editingUser === user.id ? (
                                <div className="space-y-3">
                                    <RolesSelector
                                        selectedRoles={selectedRoles[user.id] || user.roles || []}
                                        onChange={(roles) => setSelectedRoles(prev => ({ ...prev, [user.id]: roles }))}
                                        disabled={isPending}
                                    />
                                    {(selectedRoles[user.id] || user.roles || []).includes("operador") && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                            <label className="text-sm font-medium mb-1.5 block">Nombre del Operador:</label>
                                            <input
                                                type="text"
                                                value={operatorNames[user.id] === undefined ? (user.operator_name || "") : operatorNames[user.id]}
                                                onChange={(e) => setOperatorNames(prev => ({ ...prev, [user.id]: e.target.value.toUpperCase() }))}
                                                placeholder="EJ: JUAN PEREZ"
                                                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                                disabled={isPending}
                                            />
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleUpdateRoles(user.id)}
                                            disabled={isPending}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                                        >
                                            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                            Guardar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingUser(null);
                                                setSelectedRoles(prev => ({ ...prev, [user.id]: user.roles || [] }));
                                            }}
                                            disabled={isPending}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex flex-wrap gap-1">
                                        {getRoleBadges(user.roles)}
                                        {user.roles?.length > 3 && (
                                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-muted text-muted-foreground">
                                                +{user.roles.length - 3} más
                                            </span>
                                        )}
                                    </div>
                                    {user.id !== currentUserId && (
                                        <button
                                            onClick={() => {
                                                setSelectedRoles(prev => ({ ...prev, [user.id]: user.roles || [] }));
                                                setOperatorNames(prev => ({ ...prev, [user.id]: user.operator_name || "" }));
                                                setEditingUser(user.id);
                                            }}
                                            className="text-sm font-medium text-primary hover:underline"
                                        >
                                            Editar Roles
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
