"use client"

import * as React from "react"

interface ResponsiveContainerProps {
  width?: string | number
  height?: string | number
  children: React.ReactNode
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ 
  width = "100%", 
  height = "100%", 
  children 
}) => (
  <div style={{ width, height }}>
    {children}
  </div>
)

interface BarChartProps {
  data: any[]
  children: React.ReactNode
}

export const BarChart: React.FC<BarChartProps> = ({ data, children }) => (
  <div className="relative">
    {React.Children.map(children, child => 
      React.isValidElement(child) ? React.cloneElement(child, { data }) : child
    )}
  </div>
)

interface BarProps {
  dataKey: string
  fill: string
  radius?: number[]
  data?: any[]
}

export const Bar: React.FC<BarProps> = ({ dataKey, fill, radius = [0, 0, 0, 0], data = [] }) => {
  const maxValue = Math.max(...data.map(item => item[dataKey] || 0), 1)
  
  return (
    <div className="flex items-end justify-center gap-1 h-full">
      {data.map((item, index) => {
        const value = item[dataKey] || 0
        const height = (value / maxValue) * 100
        return (
          <div
            key={index}
            className="flex-1 flex flex-col items-center justify-end"
            style={{ minHeight: '20px' }}
          >
            <div
              style={{
                height: `${height}%`,
                backgroundColor: fill,
                borderRadius: `${radius[0]}px ${radius[1]}px ${radius[2]}px ${radius[3]}px`,
                width: '100%',
                minWidth: '8px'
              }}
              title={`${item.name || 'Item'}: ${value}`}
            />
            <div className="text-xs mt-1 text-center truncate w-full">
              {item.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface XAxisProps {
  dataKey: string
  angle?: number
  textAnchor?: string
  height?: number
  fontSize?: number
  data?: any[]
}

export const XAxis: React.FC<XAxisProps> = ({ data = [] }) => (
  <div className="flex justify-between mt-2 text-xs text-gray-600">
    {data.map((item, index) => (
      <div key={index} className="text-center truncate flex-1">
        {item.name}
      </div>
    ))}
  </div>
)

interface YAxisProps {}

export const YAxis: React.FC<YAxisProps> = () => (
  <div className="absolute left-0 top-0 bottom-0 w-8 text-xs text-gray-600 flex flex-col justify-between">
    {/* Y-axis labels would go here */}
  </div>
)

interface PieChartProps {
  data: any[]
  children: React.ReactNode
}

export const PieChart: React.FC<PieChartProps> = ({ data, children }) => (
  <div className="relative">
    {React.Children.map(children, child => 
      React.isValidElement(child) ? React.cloneElement(child, { data }) : child
    )}
  </div>
)

interface PieProps {
  data?: any[]
  cx?: string | number
  cy?: string | number
  outerRadius?: number
  dataKey?: string
  labelLine?: boolean
  label?: (entry: any) => string
  fill?: string
  children?: React.ReactNode
}

export const Pie: React.FC<PieProps> = ({ 
  data = [], 
  outerRadius = 80, 
  dataKey = "value", 
  label,
  children
}) => {
  const total = data.reduce((sum, item) => sum + (item[dataKey] || 0), 0)
  
  return (
    <div className="relative" style={{ width: '100%', height: '100%' }}>
      <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
        {data.map((entry, index) => {
          const value = entry[dataKey] || 0
          const percentage = total > 0 ? (value / total) : 0
          const angle = percentage * 360
          const startAngle = index === 0 ? 0 : data.slice(0, index).reduce((sum, item) => {
            return sum + ((item[dataKey] || 0) / total) * 360
          }, 0)
          
          const x1 = 100 + outerRadius * Math.cos((startAngle - 90) * Math.PI / 180)
          const y1 = 100 + outerRadius * Math.sin((startAngle - 90) * Math.PI / 180)
          const x2 = 100 + outerRadius * Math.cos((startAngle + angle - 90) * Math.PI / 180)
          const y2 = 100 + outerRadius * Math.sin((startAngle + angle - 90) * Math.PI / 180)
          
          const largeArcFlag = angle > 180 ? 1 : 0
          
          return (
            <g key={index}>
              <path
                d={`M 100 100 L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                fill={entry.color || "#8884d8"}
                stroke="white"
                strokeWidth="2"
              />
              {label && (
                <text
                  x={100 + (outerRadius * 0.75) * Math.cos((startAngle + angle/2 - 90) * Math.PI / 180)}
                  y={100 + (outerRadius * 0.75) * Math.sin((startAngle + angle/2 - 90) * Math.PI / 180)}
                  textAnchor="middle"
                  fontSize="12"
                  fill="white"
                >
                  {label(entry)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {children}
    </div>
  )
}

interface CellProps {
  fill?: string
}

export const Cell: React.FC<CellProps> = () => null
