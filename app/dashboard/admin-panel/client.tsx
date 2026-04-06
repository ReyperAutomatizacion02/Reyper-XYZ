"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
    Users,
    UserCheck,
    UserX,
    Shield,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Check,
    Briefcase,
    Search,
    Plus,
    Pencil,
    Trash2,
    ArrowUpDown,
    Activity,
    HardHat,
    X,
    GitMerge,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import {
    approveUser,
    rejectUser,
    updateUserRoles,
    migrateUserToPermissions,
    upsertEmployee,
    deleteEmployee,
    type Employee,
    type WorkShiftRow,
} from "./actions";
import { WorkShiftManager } from "@/components/admin/work-shift-manager";
import {
    ROLE_AVAILABLE_PERMISSIONS,
    ROLE_DEFAULT_PERMISSIONS,
    PERMISSION_LABELS,
    type Permission,
} from "@/lib/config/permissions";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    { value: "logistica", label: "Logística", color: "bg-sky-500" },
] as const;

type UserProfile = {
    id: string;
    full_name: string | null;
    username: string | null;
    roles: string[] | null;
    permissions: string[] | null;
    is_approved: boolean | null;
    operator_name: string | null;
    created_at: string | null;
    updated_at: string | null;
};

interface AdminPanelClientProps {
    pendingUsers: UserProfile[];
    approvedUsers: UserProfile[];
    employees: Employee[];
    shifts: WorkShiftRow[];
    currentUserId: string;
}

// Multi-select checkbox component for roles
function RolesSelector({
    selectedRoles,
    onChange,
    disabled = false,
}: {
    selectedRoles: string[];
    onChange: (roles: string[]) => void;
    disabled?: boolean;
}) {
    const toggleRole = (roleValue: string) => {
        if (selectedRoles.includes(roleValue)) {
            onChange(selectedRoles.filter((r) => r !== roleValue));
        } else {
            onChange([...selectedRoles, roleValue]);
        }
    };

    return (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {ROLES.map((role) => {
                const checked = selectedRoles.includes(role.value);
                return (
                    <div
                        key={role.value}
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => !disabled && toggleRole(role.value)}
                        onKeyDown={(e) => {
                            if (!disabled && (e.key === " " || e.key === "Enter")) {
                                e.preventDefault();
                                toggleRole(role.value);
                            }
                        }}
                        tabIndex={disabled ? -1 : 0}
                        className={`flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                            checked
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground hover:border-primary/50"
                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                        <div
                            className={`flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-sm ${checked ? role.color : "bg-muted"}`}
                        >
                            {checked && <Check className="h-2 w-2 text-white" />}
                        </div>
                        <span className="truncate">{role.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

const AREA_LABELS: Record<string, string> = {
    produccion: "Producción",
    ventas: "Ventas",
    almacen: "Almacén",
    logistica: "Logística",
    general: "General",
};

function PermissionsSelector({
    selectedRoles,
    selectedPermissions,
    onChange,
    disabled = false,
}: {
    selectedRoles: string[];
    selectedPermissions: string[];
    onChange: (permissions: string[]) => void;
    disabled?: boolean;
}) {
    const availablePermissions = Array.from(
        new Set(selectedRoles.flatMap((role) => ROLE_AVAILABLE_PERMISSIONS[role] || []))
    ) as Permission[];

    if (availablePermissions.length === 0) return null;

    const grouped = availablePermissions.reduce<Record<string, Permission[]>>((acc, perm) => {
        const area = perm.includes(":") ? perm.split(":")[0] : "general";
        if (!acc[area]) acc[area] = [];
        acc[area].push(perm);
        return acc;
    }, {});

    const toggle = (perm: string) => {
        if (selectedPermissions.includes(perm)) {
            onChange(selectedPermissions.filter((p) => p !== perm));
        } else {
            onChange([...selectedPermissions, perm]);
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-sm font-medium">Accesos específicos:</p>
            {Object.entries(grouped).map(([area, perms]) => (
                <div key={area} className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {AREA_LABELS[area] || area}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {perms.map((perm) => {
                            const checked = selectedPermissions.includes(perm);
                            return (
                                <div
                                    key={perm}
                                    role="checkbox"
                                    aria-checked={checked}
                                    onClick={() => !disabled && toggle(perm)}
                                    onKeyDown={(e) => {
                                        if (!disabled && (e.key === " " || e.key === "Enter")) {
                                            e.preventDefault();
                                            toggle(perm);
                                        }
                                    }}
                                    tabIndex={disabled ? -1 : 0}
                                    className={`flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                                        checked
                                            ? "border-primary bg-primary/10 text-foreground"
                                            : "border-border text-muted-foreground hover:border-primary/50"
                                    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                                >
                                    <div
                                        className={`flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-sm ${
                                            checked ? "bg-primary" : "bg-muted"
                                        }`}
                                    >
                                        {checked && <Check className="h-2 w-2 text-white" />}
                                    </div>
                                    <span className="truncate">{PERMISSION_LABELS[perm]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
    return (
        <div className="flex items-center space-x-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            <div className={`rounded-lg p-2 ${color}`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <h3 className="text-2xl font-bold">{value}</h3>
            </div>
        </div>
    );
}

type SortConfig = {
    key: keyof Employee;
    direction: "asc" | "desc";
} | null;

function EmployeesTab({ employees }: { employees: Employee[] }) {
    const [isPending, startTransition] = useTransition();
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Form State
    const [formData, setFormData] = useState({
        full_name: "",
        employee_number: "",
        department: "",
        position: "",
        is_operator: false,
        is_active: true,
    });

    const handleSort = (key: keyof Employee) => {
        setSortConfig((current) => {
            if (current && current.key === key) {
                return { key, direction: current.direction === "asc" ? "desc" : "asc" };
            }
            return { key, direction: "asc" };
        });
    };

    const sortedEmployees = useMemo(() => {
        let sortableItems = [...employees];
        if (searchTerm) {
            sortableItems = sortableItems.filter(
                (emp) =>
                    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    emp.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    emp.employee_number?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === bValue) return 0;
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (aValue < bValue) {
                    return sortConfig.direction === "asc" ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === "asc" ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [employees, searchTerm, sortConfig]);

    const stats = useMemo(
        () => ({
            total: employees.length,
            active: employees.filter((e) => e.is_active).length,
            operators: employees.filter((e) => e.is_operator).length,
        }),
        [employees]
    );

    const handleOpenDialog = (employee?: Employee) => {
        if (employee) {
            setEditingEmployee(employee);
            setFormData({
                full_name: employee.full_name,
                employee_number: employee.employee_number || "",
                department: employee.department || "",
                position: employee.position || "",
                is_operator: employee.is_operator || false,
                is_active: employee.is_active ?? true,
            });
        } else {
            setEditingEmployee(null);
            setFormData({
                full_name: "",
                employee_number: "",
                department: "",
                position: "",
                is_operator: false,
                is_active: true,
            });
        }
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!formData.full_name) return alert("El nombre es obligatorio");

        startTransition(async () => {
            try {
                await upsertEmployee({
                    id: editingEmployee?.id,
                    ...formData,
                });
                setIsDialogOpen(false);
            } catch (error: any) {
                alert(error.message);
            }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este colaborador?")) return;
        startTransition(async () => {
            try {
                await deleteEmployee(id);
            } catch (error: any) {
                alert(error.message);
            }
        });
    };

    const SortIcon = ({ column }: { column: keyof Employee }) => {
        if (sortConfig?.key !== column)
            return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground opacity-50" />;
        return (
            <ArrowUpDown
                className={`ml-1 h-4 w-4 ${sortConfig.direction === "asc" ? "text-primary" : "rotate-180 text-primary"}`}
            />
        );
    };

    const SortableHeader = ({
        label,
        column,
        align = "left",
    }: {
        label: string;
        column: keyof Employee;
        align?: "left" | "center" | "right";
    }) => (
        <th
            className={`cursor-pointer select-none px-4 py-3 font-medium transition-colors hover:bg-muted/80 text-${align}`}
            onClick={() => handleSort(column)}
        >
            <div
                className={`flex items-center ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}
            >
                {label}
                <SortIcon column={column} />
            </div>
        </th>
    );

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatsCard title="Total Colaboradores" value={stats.total} icon={Users} color="bg-blue-500" />
                <StatsCard title="Colaboradores Activos" value={stats.active} icon={Activity} color="bg-green-500" />
                <StatsCard title="Operadores" value={stats.operators} icon={HardHat} color="bg-orange-500" />
            </div>

            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, puesto o n.º..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Colaborador
                </Button>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow">
                <div className="w-full overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                            <tr>
                                <SortableHeader label="No. Emp" column="employee_number" />
                                <SortableHeader label="Nombre" column="full_name" />
                                <SortableHeader label="Depto." column="department" />
                                <SortableHeader label="Puesto" column="position" />
                                <SortableHeader label="Es Operador" column="is_operator" align="center" />
                                <SortableHeader label="Estado" column="is_active" align="center" />
                                <th className="px-4 py-3 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                        No se encontraron colaboradores.
                                    </td>
                                </tr>
                            ) : (
                                sortedEmployees.map((emp) => (
                                    <tr key={emp.id} className="transition-colors hover:bg-muted/50">
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {emp.employee_number || "-"}
                                        </td>
                                        <td className="px-4 py-3 font-medium">{emp.full_name}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{emp.department || "-"}</td>
                                        <td className="px-4 py-3">{emp.position || "-"}</td>
                                        <td className="px-4 py-3 text-center">
                                            {emp.is_operator ? (
                                                <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-300">
                                                    Sí
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {emp.is_active ? (
                                                <span
                                                    className="inline-block h-2 w-2 rounded-full bg-green-500"
                                                    title="Activo"
                                                ></span>
                                            ) : (
                                                <span
                                                    className="inline-block h-2 w-2 rounded-full bg-red-500"
                                                    title="Inactivo"
                                                ></span>
                                            )}
                                        </td>
                                        <td className="space-x-1 px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleOpenDialog(emp)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(emp.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingEmployee ? "Editar Colaborador" : "Nuevo Colaborador"}</DialogTitle>
                        <DialogDescription>
                            Gestiona la información del colaborador y define si es un operador.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre Completo</label>
                                <Input
                                    value={formData.full_name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                                    placeholder="Ej: Juan Perez"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">No. Empleado</label>
                                <Input
                                    value={formData.employee_number}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, employee_number: e.target.value }))
                                    }
                                    placeholder="Ej: EMP-001"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Departamento</label>
                                <Input
                                    value={formData.department}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
                                    placeholder="Ej: Producción"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Cargo / Puesto</label>
                                <Input
                                    value={formData.position}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                                    placeholder="Ej: Supervisor"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_operator"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.is_operator}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, is_operator: e.target.checked }))
                                    }
                                />
                                <label htmlFor="is_operator" className="cursor-pointer text-sm font-medium">
                                    ¿Es Operador? (Aparecerá en la lista de asignación)
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                                />
                                <label htmlFor="is_active" className="cursor-pointer text-sm font-medium">
                                    ¿Activo?
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function AdminPanelClient({
    pendingUsers,
    approvedUsers,
    employees,
    shifts,
    currentUserId,
}: AdminPanelClientProps) {
    const [isPending, startTransition] = useTransition();
    const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>({});
    const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({});
    const [operatorNames, setOperatorNames] = useState<Record<string, string>>({});
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"users" | "collaborators" | "shifts">("users");

    const handleRolesChange = (userId: string, newRoles: string[]) => {
        const prevRoles = selectedRoles[userId] || [];
        setSelectedRoles((prev) => ({ ...prev, [userId]: newRoles }));

        const prevPerms = new Set(selectedPermissions[userId] || []);

        // Add defaults for newly added roles
        const addedRoles = newRoles.filter((r) => !prevRoles.includes(r));
        for (const role of addedRoles) {
            for (const perm of ROLE_DEFAULT_PERMISSIONS[role] || []) {
                prevPerms.add(perm);
            }
        }

        // Remove permissions that no longer belong to any remaining role
        const availableInRemaining = new Set(newRoles.flatMap((r) => ROLE_AVAILABLE_PERMISSIONS[r] || []));
        const newPerms = Array.from(prevPerms).filter((p) => availableInRemaining.has(p as Permission));

        setSelectedPermissions((prev) => ({ ...prev, [userId]: newPerms }));
    };

    const handleApprove = (userId: string) => {
        const roles = selectedRoles[userId] || ["produccion"];
        if (roles.length === 0) {
            alert("Debe seleccionar al menos un rol");
            return;
        }
        startTransition(async () => {
            try {
                const operatorName = operatorNames[userId];
                const permissions = selectedPermissions[userId] || [];
                await approveUser(userId, roles, permissions, operatorName);
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
                const permissions = selectedPermissions[userId] || [];
                await updateUserRoles(userId, roles, permissions, operatorName);
                setEditingUser(null);
            } catch (error: any) {
                console.error(error);
                alert(error.message || "Error al actualizar roles");
            }
        });
    };

    const handleMigrate = useCallback(
        (userId: string) => {
            startTransition(async () => {
                try {
                    const result = await migrateUserToPermissions(userId);
                    if (result.alreadyMigrated) {
                        toast.info("Este usuario ya usa el sistema de permisos.");
                    } else {
                        toast.success("Usuario migrado al sistema de permisos.");
                    }
                } catch (error: any) {
                    toast.error(error.message || "Error al migrar permisos.");
                }
            });
        },
        [startTransition]
    );

    const getRoleBadges = (roles: string[]) => {
        return (
            roles?.slice(0, 3).map((r) => {
                const role = ROLES.find((role) => role.value === r);
                return (
                    <span
                        key={r}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${role?.color || "bg-muted"} text-white`}
                    >
                        {role?.label || r}
                    </span>
                );
            }) || null
        );
    };

    // Prepare employee options (all active employees)
    const employeeOptions = employees
        .filter((e) => e.is_active)
        .map((e) => ({ label: e.full_name, value: e.full_name }));

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-6">
            <DashboardHeader
                title="Panel Admin"
                description="Gestiona usuarios y colaboradores"
                icon={<Shield className="h-8 w-8 text-primary" />}
                children={
                    <div className="flex rounded-lg bg-muted p-1">
                        <button
                            onClick={() => setActiveTab("users")}
                            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                                activeTab === "users"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Usuarios del Sistema
                        </button>
                        <button
                            onClick={() => setActiveTab("collaborators")}
                            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                                activeTab === "collaborators"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Colaboradores / Operadores
                        </button>
                        <button
                            onClick={() => setActiveTab("shifts")}
                            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                                activeTab === "shifts"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Turnos de Producción
                        </button>
                    </div>
                }
            />

            {activeTab === "shifts" ? (
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        <div>
                            <h2 className="text-lg font-semibold">Turnos de Producción</h2>
                            <p className="text-sm text-muted-foreground">
                                Define los horarios de trabajo. El planificador automático respeta estos turnos al
                                dividir tareas.
                            </p>
                        </div>
                    </div>
                    <WorkShiftManager initialShifts={shifts} />
                </section>
            ) : activeTab === "collaborators" ? (
                <EmployeesTab employees={employees} />
            ) : (
                <>
                    {/* Pending Users Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-orange-500" />
                            <h2 className="text-lg font-semibold">Usuarios Pendientes</h2>
                            {pendingUsers.length > 0 && (
                                <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-500">
                                    {pendingUsers.length}
                                </span>
                            )}
                        </div>

                        {pendingUsers.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
                                <UserCheck className="mx-auto mb-2 h-12 w-12 text-muted-foreground/50" />
                                <p className="text-muted-foreground">No hay usuarios pendientes</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {pendingUsers.map((user) => (
                                    <div key={user.id} className="rounded-xl border border-border bg-card p-4">
                                        <div className="mb-4 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-semibold">{user.full_name || "Sin nombre"}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    @{user.username || "sin-usuario"}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Registrado:{" "}
                                                    {new Date(user.created_at ?? "").toLocaleDateString("es-MX", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <p className="mb-2 text-sm font-medium">Seleccionar Roles:</p>
                                            <RolesSelector
                                                selectedRoles={selectedRoles[user.id] || ["produccion"]}
                                                onChange={(roles) => handleRolesChange(user.id, roles)}
                                                disabled={isPending}
                                            />
                                        </div>

                                        <div className="mb-4">
                                            <PermissionsSelector
                                                selectedRoles={selectedRoles[user.id] || ["produccion"]}
                                                selectedPermissions={selectedPermissions[user.id] || []}
                                                onChange={(perms) =>
                                                    setSelectedPermissions((prev) => ({
                                                        ...prev,
                                                        [user.id]: perms,
                                                    }))
                                                }
                                                disabled={isPending}
                                            />
                                        </div>

                                        <div className="mb-4 duration-200 animate-in fade-in slide-in-from-top-2">
                                            <label className="mb-1.5 block text-sm font-medium">
                                                Vincular con Colaborador:
                                            </label>
                                            <SearchableSelect
                                                options={employeeOptions}
                                                value={operatorNames[user.id] || ""}
                                                onChange={(val) =>
                                                    setOperatorNames((prev) => ({ ...prev, [user.id]: val }))
                                                }
                                                placeholder="Buscar colaborador..."
                                                className="w-full"
                                            />
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Vincula este usuario con un registro de colaborador.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleApprove(user.id)}
                                                disabled={isPending}
                                                className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                                            >
                                                {isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="h-4 w-4" />
                                                )}
                                                Aprobar
                                            </button>
                                            <button
                                                onClick={() => handleReject(user.id)}
                                                disabled={isPending}
                                                className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                                            >
                                                {isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <XCircle className="h-4 w-4" />
                                                )}
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
                            <Users className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Usuarios Activos</h2>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                {approvedUsers.length}
                            </span>
                        </div>

                        <div className="grid gap-4">
                            {approvedUsers.map((user) => (
                                <div key={user.id} className="rounded-xl border border-border bg-card p-4">
                                    <div className="mb-3 flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{user.full_name || "Sin nombre"}</p>
                                                {user.id === currentUserId && (
                                                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                                        Tú
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                                            {user.operator_name && (
                                                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Briefcase className="h-3 w-3" />
                                                    <span>
                                                        Operador:{" "}
                                                        <span className="font-medium text-foreground">
                                                            {user.operator_name}
                                                        </span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(user.updated_at ?? "").toLocaleDateString("es-MX", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </p>
                                    </div>

                                    {editingUser === user.id ? (
                                        <div className="space-y-3">
                                            <RolesSelector
                                                selectedRoles={selectedRoles[user.id] || user.roles || []}
                                                onChange={(roles) => handleRolesChange(user.id, roles)}
                                                disabled={isPending}
                                            />
                                            <PermissionsSelector
                                                selectedRoles={selectedRoles[user.id] || user.roles || []}
                                                selectedPermissions={selectedPermissions[user.id] || []}
                                                onChange={(perms) =>
                                                    setSelectedPermissions((prev) => ({
                                                        ...prev,
                                                        [user.id]: perms,
                                                    }))
                                                }
                                                disabled={isPending}
                                            />
                                            <div className="duration-200 animate-in fade-in slide-in-from-top-2">
                                                <label className="mb-1.5 block text-sm font-medium">
                                                    Vincular con Colaborador:
                                                </label>
                                                {(() => {
                                                    const currentVal =
                                                        operatorNames[user.id] === undefined
                                                            ? user.operator_name || ""
                                                            : operatorNames[user.id];
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <SearchableSelect
                                                                options={employeeOptions}
                                                                value={currentVal}
                                                                onChange={(val) =>
                                                                    setOperatorNames((prev) => ({
                                                                        ...prev,
                                                                        [user.id]: val,
                                                                    }))
                                                                }
                                                                placeholder="Buscar colaborador..."
                                                                className="flex-1"
                                                            />
                                                            {currentVal && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setOperatorNames((prev) => ({
                                                                            ...prev,
                                                                            [user.id]: "",
                                                                        }))
                                                                    }
                                                                    title="Desvincular colaborador"
                                                                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleUpdateRoles(user.id)}
                                                    disabled={isPending}
                                                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                                                >
                                                    {isPending ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Check className="h-3 w-3" />
                                                    )}
                                                    Guardar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingUser(null);
                                                        setSelectedRoles((prev) => ({
                                                            ...prev,
                                                            [user.id]: user.roles || [],
                                                        }));
                                                        setSelectedPermissions((prev) => ({
                                                            ...prev,
                                                            [user.id]: user.permissions || [],
                                                        }));
                                                    }}
                                                    disabled={isPending}
                                                    className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {getRoleBadges(user.roles || [])}
                                                {(user.roles?.length ?? 0) > 3 && (
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                                                        +{(user.roles?.length ?? 0) - 3} más
                                                    </span>
                                                )}
                                                {/* Auth system badge */}
                                                {user.permissions === null ? (
                                                    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                                        Legacy
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400">
                                                        Permisos
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => {
                                                        setSelectedRoles((prev) => ({
                                                            ...prev,
                                                            [user.id]: user.roles || [],
                                                        }));
                                                        setSelectedPermissions((prev) => ({
                                                            ...prev,
                                                            [user.id]:
                                                                user.permissions ??
                                                                Array.from(
                                                                    new Set(
                                                                        (user.roles || []).flatMap(
                                                                            (r) => ROLE_DEFAULT_PERMISSIONS[r] || []
                                                                        )
                                                                    )
                                                                ),
                                                        }));
                                                        setOperatorNames((prev) => ({
                                                            ...prev,
                                                            [user.id]: user.operator_name || "",
                                                        }));
                                                        setEditingUser(user.id);
                                                    }}
                                                    className="text-sm font-medium text-primary hover:underline"
                                                >
                                                    Editar Roles y Permisos
                                                </button>
                                                {user.permissions === null && (
                                                    <button
                                                        onClick={() => handleMigrate(user.id)}
                                                        disabled={isPending}
                                                        className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-400/20 disabled:opacity-50 dark:text-amber-400"
                                                    >
                                                        {isPending ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <GitMerge className="h-3 w-3" />
                                                        )}
                                                        Migrar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
