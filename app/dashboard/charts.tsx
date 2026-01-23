"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
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
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickMargin={10}
                        interval={4}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="newProjects"
                        name="Nuevos"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorNew)"
                    />
                    <Area
                        type="monotone"
                        dataKey="deliveredProjects"
                        name="Entregados"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorDelivered)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
