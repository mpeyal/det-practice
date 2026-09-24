import React from 'react'
import { gpnSection } from '../lib/gpnPractice.js'

export default function GpnBooklet({ go, type, timed }) {
  const section = gpnSection(type)
  const url = `./gpn-booklet.pdf#page=${section.page + 4}`
  return <div className="mx-auto w-full max-w-5xl pb-8">
    <button className="mb-4 text-sm font-extrabold text-neutral-400" onClick={() => go({ name: 'gpn-section', type, timed })}>← {section.label}</button>
    <h1 className="mb-2 text-xl font-black">{section.label} · Original booklet</h1>
    <p className="mb-3 text-sm text-neutral-500">Printed page {section.page} (PDF page {section.page + 4}). The answer section starts at PDF page 161.</p>
    <iframe title={`${section.label} booklet pages`} src={url} className="w-full rounded-xl border-2 border-neutral-200 bg-white" style={{ height: '72vh' }} />
    <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-[#1899d6]">Open PDF in a separate window</a>
  </div>
}
