"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";

interface UtilizationChartProps {
    data: {
        machine: string;
        efficiency: number; // 0-100
        hours: number;
    }[];
}

interface TrendChartProps {
    data: {
        date: string;
        newProjects: number;
        deliveredProjects: number;
    }[];
}

export function UtilizationChart({ data }: UtilizationChartProps) {
    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 40, right: 20, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} unit="%" hide />
                    <YAxis
                        type="category"
                        dataKey="machine"
                        width={100}
                        tick={{ fontSize: 12 }}
                        interval={0}
                    />
                    <Tooltip
                        cursor={{ fill: 'transparent' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-popover border border-border p-2 rounded-lg shadow-lg">
                                        <p className="font-semibold text-sm">{d.machine}</p>
                                        <p className="text-sm text-green-500 font-medium">
                                            {d.efficiency.toFixed(1)}% ({d.hours.toFixed(1)}h)
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar
                        dataKey="efficiency"
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function ProjectsTrendChart({ data }: TrendChartProps) {
    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickMargin={10}
                        interval={4}
                    />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                    />
                    <Line
                        type="linear"
                        dataKey="newProjects"
                        name="Nuevos"
                        stroke="#676161"
                        strokeWidth={2}
                        dot={(props: any) => {
                            const { cx, cy, value } = props;
                            if (value === 0) return <></>;
                            return <circle cx={cx} cy={cy} r={3} fill="#676161" />;
                        }}
                        activeDot={{ r: 5 }}
                    />
                    <Line
                        type="linear"
                        dataKey="deliveredProjects"
                        name="Entregados"
                        stroke="#EC1C21"
                        strokeWidth={2}
                        dot={(props: any) => {
                            const { cx, cy, value } = props;
                            if (value === 0) return <></>;
                            return <circle cx={cx} cy={cy} r={3} fill="#EC1C21" />;
                        }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

interface StatusChartProps {
    data: {
        name: string;
        value: number;
    }[];
}

const STATUS_COLORS = {
    'MATERIAL / ING.': '#3b82f6', // Blue
    'MAQUINADO / PROCESO': '#EC1C21', // Red (Brand)
    'TRATAMIENTO': '#a855f7', // Purple
    'TERMINADO / ENTREGA': '#10b981', // Green
    'CANCELADO': '#ef4444', // Red-500
    'GARANTÍA': '#f59e0b',  // Amber
    'OTROS': '#64748b' // Slate
};

const DEFAULT_COLORS = ['#EC1C21', '#676161', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export function ItemsStatusChart({ data }: StatusChartProps) {
    if (!data || data.length === 0) {
        return <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">No data</div>;
    }

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={85}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {data.map((entry, index) => {
                            // Try to match specific colors, else fallback
                            const colorKey = Object.keys(STATUS_COLORS).find(k => entry.name.toUpperCase().includes(k));
                            return (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={colorKey ? STATUS_COLORS[colorKey as keyof typeof STATUS_COLORS] : DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                                />
                            );
                        })}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ fontSize: '12px' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
