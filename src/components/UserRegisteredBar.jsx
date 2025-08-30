import React from 'react'
import { ComposedChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

export default function UserRegisteredBar({registerPerDay}) {
  return (
     <div className='ChartContainer'>
            <ComposedChart
              layout="vertical"
              width={500}
              height={400}
              data={registerPerDay}
              margin={{
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              }}
            >
              <XAxis
                type="number"
                label={{
                  value: "Número de ingresos",
                  position: "insideBottom",
                  offset: -10,
                }}
              />
              <YAxis
                dataKey="day"
                type="category"
                label={{
                  value: "Date Submitted",
                  position: "insideLeft",
                  angle: -90,
                  offset: -20,
                }}
              />
              <Tooltip />
              <Bar dataKey="count" barSize={40} fill="#413ea0" />
            </ComposedChart>
            <h2>Cantidad de usuarios por fecha</h2>
          </div>
  )
}
