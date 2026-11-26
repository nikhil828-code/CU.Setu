'use client'

/**
 * Shared circular-layout SVG graph used by the Playground Graph and BFS tabs.
 *
 * Nodes are placed deterministically: the caller passes the full node list
 * (sorted by username) and the component arranges them evenly on a circle.
 * All visibility / coloring decisions live in the caller — this component is
 * purely presentational so both tabs can derive state from step data.
 */

import { motion } from 'framer-motion'

export interface CircleNodeVisual {
  username: string
  full_name: string
  visible: boolean
  /** Circle fill color. */
  fill: string
  /** Optional outer ring color (e.g. the pulsing "current" highlight). */
  ring?: string
  /** Muted look for unvisited nodes (BFS before discovery). */
  dim?: boolean
}

export interface CircleEdgeVisual {
  source: string
  target: string
  visible: boolean
  color: string
  width: number
}

export interface CircleGraphProps {
  nodes: CircleNodeVisual[]
  edges: CircleEdgeVisual[]
  onNodeClick?: (username: string) => void
  selected?: string | null
}

const SIZE = 640
const CENTER = SIZE / 2
const RADIUS = 246
const NODE_R = 26

function initials(fullName: string): string {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

export function CircleGraph({ nodes, edges, onNodeClick, selected }: CircleGraphProps) {
  const ordered = [...nodes].sort((a, b) => a.username.localeCompare(b.username))
  const count = ordered.length || 1

  const positions = new Map<string, { x: number; y: number }>()
  ordered.forEach((node, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
    positions.set(node.username, {
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    })
  })

  const pos = (username: string) => positions.get(username) ?? { x: CENTER, y: CENTER }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto h-auto w-full max-w-[560px] select-none"
      role="img"
      aria-label={`Graph of ${count} students arranged on a circle`}
    >
      <defs>
        <radialGradient id="circle-node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Edges (drawn first so nodes sit on top) */}
      {edges.map((edge) => {
        if (!edge.visible) return null
        const from = pos(edge.source)
        const to = pos(edge.target)
        return (
          <motion.line
            key={`${edge.source}->${edge.target}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={edge.color}
            strokeWidth={edge.width}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )
      })}

      {/* Nodes */}
      {ordered.map((node) => {
        if (!node.visible) return null
        const { x, y } = pos(node.username)
        const clickable = Boolean(onNodeClick)
        return (
          <motion.g
            key={node.username}
            initial={{ opacity: 0 }}
            animate={{ opacity: node.dim ? 0.55 : 1 }}
            transition={{ duration: 0.35 }}
          >
            {/* soft glow halo */}
            <circle cx={x} cy={y} r={NODE_R + 14} fill="url(#circle-node-glow)" opacity={node.dim ? 0 : 0.9} />
            {node.ring ? (
              <circle
                cx={x}
                cy={y}
                r={NODE_R + 7}
                fill="none"
                stroke={node.ring}
                strokeWidth={3.5}
                className="animate-pulse"
              />
            ) : null}
            {selected === node.username ? (
              <circle cx={x} cy={y} r={NODE_R + 4} fill="none" stroke="#F59E0B" strokeWidth={3} />
            ) : null}
            <circle
              cx={x}
              cy={y}
              r={NODE_R}
              fill={node.fill}
              stroke="#0F1F46"
              strokeWidth={selected === node.username ? 2 : 1}
              className={clickable ? 'cursor-pointer' : undefined}
              onClick={onNodeClick ? () => onNodeClick(node.username) : undefined}
            >
              <title>{`${node.full_name} (@${node.username})`}</title>
            </circle>
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill="#FFFFFF"
              pointerEvents="none"
            >
              {initials(node.full_name)}
            </text>
            <text
              x={x}
              y={y + NODE_R + 17}
              textAnchor="middle"
              fontSize={10.5}
              fontWeight={600}
              fill="#0F1F46"
              pointerEvents="none"
            >
              {node.username}
            </text>
          </motion.g>
        )
      })}
    </svg>
  )
}
