// src/components/DashboardCharts.jsx

import React from "react";
import {
  PieChart, Pie, Cell, Legend,
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer
} from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#a4de6c"];

export default function DashboardCharts({ clients }) {
  const pieData = groupByCuotas(clients);
  const barData = countPerDay(clients);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      {/* PieChart: distribución por cuotas */}
      <div>
        <h3>Distribución de cuotas</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={100}
              fill="#8884d8"
              label
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend verticalAlign="bottom" height={36}/>
            <Tooltip formatter={v => v} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* BarChart: envíos por día */}
      <div>
        <h3>Envíos por día</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// importa tus helpers aquí
function groupByCuotas(clients) {
  return Object.entries(
    clients.reduce((acc, c) => {
      acc[c.cuotas] = (acc[c.cuotas] || 0) + 1;
      return acc;
    }, {})
  ).map(([cuotas, count]) => ({ name: `${cuotas} cuotas`, value: count }));
}

function countPerDay(clients) {
  const acc = {};
  clients.forEach(c => {
    const date = new Date(c.timestamp.seconds * 1000)
      .toLocaleDateString("es-AR");
    acc[date] = (acc[date] || 0) + 1;
  });
  return Object.entries(acc)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([date, count]) => ({ date, count }));
}
