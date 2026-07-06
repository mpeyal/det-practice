import React from 'react'
import { PhotoView } from './ui.jsx'
import AudioBar from './AudioBar.jsx'

/**
 * Shows the actual QUESTION for a graded item on the review screen, so the
 * user can see what each answer was responding to. Rendered above the answer
 * detail in each review card.
 */
export default function QuestionView({ item }) {
  const p = item.payload || {}
  const Box = ({ children }) => (
    <div className="mb-3 rounded-2xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700">{children}</div>
  )
  const Label = ({ children }) => (
    <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-neutral-400">{children}</div>
  )

  switch (item.type) {
    case 'read_select':
      return null // each word shown in the answer grid is itself the question

    case 'fill_blanks':
      return (
        <Box>
          <Label>Question — type the missing letters</Label>
          {p.before}<b className="text-[#1899d6]">{p.shown}____</b>{p.after}
        </Box>
      )

    case 'read_complete':
      return (
        <Box>
          <Label>Question — complete the paragraph ({p.topic})</Label>
          Restore each partly-hidden word in the paragraph.
        </Box>
      )

    case 'listen_type':
      return (
        <div className="mb-3">
          <Label>Question — listen and type what you hear</Label>
          <AudioBar text={p.text} maxPlays={99} />
        </div>
      )

    case 'interactive_reading': {
      const filled = (p.passage || `${p.paragraph1 || ''} ${p.paragraph2 || ''}`)
        .replace(/\{(\d+)\}/g, (_, d) => p.blanks[Number(d) - 1]?.answer || '____')
      return (
        <Box>
          <Label>Passage ({p.topic})</Label>
          <p>{filled}</p>
        </Box>
      )
    }

    case 'interactive_listening':
      return (
        <div className="mb-3">
          <Label>Conversation — {p.scenario}</Label>
          <div className="rounded-2xl bg-neutral-50 p-3 text-sm">
            <div className="mb-2">
              <AudioBar text={p.turns.filter(t => t.kind === 'line').map(t => t.text).join(' ')} maxPlays={99} />
            </div>
            {p.turns.filter(t => t.kind === 'line').map((t, i) => (
              <p key={i} className="text-neutral-600"><b>{p.partner}:</b> {t.text}</p>
            ))}
          </div>
        </div>
      )

    case 'write_photo':
    case 'speak_photo':
      return (
        <div className="mb-3">
          <Label>Question — {item.type === 'write_photo' ? 'write about this photo' : 'speak about this photo'}</Label>
          <PhotoView photo={p.photo} />
        </div>
      )

    case 'interactive_writing':
      return (
        <Box>
          <Label>Question — Interactive Writing</Label>
          <p><b>Part 1:</b> {p.prompt}</p>
          <p className="mt-1"><b>Part 2 (follow-up):</b> {p.followUp}</p>
        </Box>
      )

    case 'read_then_speak':
    case 'writing_sample':
    case 'speaking_sample':
      return (
        <Box>
          <Label>Question — prompt</Label>
          {p.prompt}
        </Box>
      )

    case 'interactive_speaking':
      return (
        <Box>
          <Label>Questions — {p.scenario}</Label>
          <ol className="ml-4 list-decimal space-y-0.5">
            {p.questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </Box>
      )

    default:
      return null
  }
}
