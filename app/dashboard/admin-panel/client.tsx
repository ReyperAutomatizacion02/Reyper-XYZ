"use client";

import { useState, useTransition, useMemo } from "react";
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
    HardHat
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { approveUser, rejectUser, updateUserRoles, upsertEmployee, deleteEmployee, type Employee } from "./actions";
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
    employees: Employee[];
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

function StatsCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
    return (
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center space-x-4">
            <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-5 h-5 text-white" />
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
    direction: 'asc' | 'desc';
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
        setSortConfig(current => {
            if (current && current.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const sortedEmployees = useMemo(() => {
        let sortableItems = [...employees];
        if (searchTerm) {
            sortableItems = sortableItems.filter(emp =>
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
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [employees, searchTerm, sortConfig]);

    const stats = useMemo(() => ({
        total: employees.length,
        active: employees.filter(e => e.is_active).length,
        operators: employees.filter(e => e.is_operator).length
    }), [employees]);

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
                is_active: true
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
                    ...formData
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
        if (sortConfig?.key !== column) return <ArrowUpDown className="w-4 h-4 text-muted-foreground opacity-50 ml-1" />;
        return <ArrowUpDown className={`w-4 h-4 ml-1 ${sortConfig.direction === 'asc' ? 'text-primary' : 'text-primary rotate-180'}`} />;
    };

    const SortableHeader = ({ label, column, align = 'left' }: { label: string, column: keyof Employee, align?: 'left' | 'center' | 'right' }) => (
        <th
            className={`px-4 py-3 font-medium cursor-pointer hover:bg-muted/80 transition-colors select-none text-${align}`}
            onClick={() => handleSort(column)}
        >
            <div className={`flex items-center ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
                {label}
                <SortIcon column={column} />
            </div>
        </th>
    );

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                    title="Total Colaboradores"
                    value={stats.total}
                    icon={Users}
                    color="bg-blue-500"
                />
                <StatsCard
                    title="Colaboradores Activos"
                    value={stats.active}
                    icon={Activity}
                    color="bg-green-500"
                />
                <StatsCard
                    title="Operadores"
                    value={stats.operators}
                    icon={HardHat}
                    color="bg-orange-500"
                />
            </div>

            <div className="flex justify-between items-center">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, puesto o n.º..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nuevo Colaborador
                </Button>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow">
                <div className="w-full overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                            <tr>
                                <SortableHeader label="No. Emp" column="employee_number" />
                                <SortableHeader label="Nombre" column="full_name" />
                                <SortableHeader label="Depto." column="department" />
                                <SortableHeader label="Puesto" column="position" />
                                <SortableHeader label="Es Operador" column="is_operator" align="center" />
                                <SortableHeader label="Estado" column="is_active" align="center" />
                                <th className="px-4 py-3 font-medium text-right">Acciones</th>
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
                                    <tr key={emp.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 text-muted-foreground">{emp.employee_number || "-"}</td>
                                        <td className="px-4 py-3 font-medium">{emp.full_name}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{emp.department || "-"}</td>
                                        <td className="px-4 py-3">{emp.position || "-"}</td>
                                        <td className="px-4 py-3 text-center">
                                            {emp.is_operator ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                                    Sí
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {emp.is_active ? (
                                                <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Activo"></span>
                                            ) : (
                                                <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="Inactivo"></span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right space-x-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(emp)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(emp.id)}>
                                                <Trash2 className="w-4 h-4" />
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
                                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                    placeholder="Ej: Juan Perez"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">No. Empleado</label>
                                <Input
                                    value={formData.employee_number}
                                    onChange={(e) => setFormData(prev => ({ ...prev, employee_number: e.target.value }))}
                                    placeholder="Ej: EMP-001"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Departamento</label>
                                <Input
                                    value={formData.department}
                                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                    placeholder="Ej: Producción"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Cargo / Puesto</label>
                                <Input
                                    value={formData.position}
                                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                                    placeholder="Ej: Supervisor"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_operator"
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.is_operator}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_operator: e.target.checked }))}
                                />
                                <label htmlFor="is_operator" className="text-sm font-medium cursor-pointer">
                                    ¿Es Operador? (Aparecerá en la lista de asignación)
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                />
                                <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                                    ¿Activo?
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
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

export function AdminPanelClient({ pendingUsers, approvedUsers, employees, currentUserId }: AdminPanelClientProps) {
    const [isPending, startTransition] = useTransition();
    const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>({});
    const [operatorNames, setOperatorNames] = useState<Record<string, string>>({});
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'collaborators'>('users');

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

    // Prepare employee options (all active employees)
    const employeeOptions = employees
        .filter(e => e.is_active)
        .map(e => ({ label: e.full_name, value: e.full_name }));

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <DashboardHeader
                title="Panel de Administración"
                description="Gestiona usuarios y colaboradores"
                icon={<Shield className="w-8 h-8 text-primary" />}
                children={
                    <div className="flex p-1 bg-muted rounded-lg">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'users'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Usuarios del Sistema
                        </button>
                        <button
                            onClick={() => setActiveTab('collaborators')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'collaborators'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Colaboradores / Operadores
                        </button>
                    </div>
                }
            />

            {activeTab === 'collaborators' ? (
                <EmployeesTab employees={employees} />
            ) : (
                <>
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

                                        <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <label className="text-sm font-medium mb-1.5 block">Vincular con Colaborador:</label>
                                            <SearchableSelect
                                                options={employeeOptions}
                                                value={operatorNames[user.id] || ""}
                                                onChange={(val) => setOperatorNames(prev => ({ ...prev, [user.id]: val }))}
                                                placeholder="Buscar colaborador..."
                                                className="w-full"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Vincula este usuario con un registro de colaborador.
                                            </p>
                                        </div>

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
                                            {user.operator_name && (
                                                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Briefcase className="w-3 h-3" />
                                                    <span>Operador: <span className="font-medium text-foreground">{user.operator_name}</span></span>
                                                </div>
                                            )}
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
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                <label className="text-sm font-medium mb-1.5 block">Vincular con Colaborador:</label>
                                                <SearchableSelect
                                                    options={employeeOptions}
                                                    value={operatorNames[user.id] === undefined ? (user.operator_name || "") : operatorNames[user.id]}
                                                    onChange={(val) => setOperatorNames(prev => ({ ...prev, [user.id]: val }))}
                                                    placeholder="Buscar colaborador..."
                                                    className="w-full"
                                                />
                                            </div>
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
