import React from 'react'
import VERSION_RAW from '../../VERSION?raw'

const version = (VERSION_RAW || '').trim()

export default function VersionBadge() {
  if (!version) return null
  return (
    <div className="fixed right-3 bottom-3 z-50 pointer-events-none">
      <div className="bg-white/80 text-secondary-700 text-[11px] px-2 py-1 rounded-md shadow-sm backdrop-blur-sm opacity-90 pointer-events-auto">
        v{version}
      </div>
    </div>
  )
}
