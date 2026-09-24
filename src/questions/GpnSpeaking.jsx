import React from 'react'
import { PrepRecordTask } from './SpeakingTasks.jsx'
import RecordedAudio from '../components/RecordedAudio.jsx'

export function ReadAloud({ item, timed, onComplete }) {
  return <PrepRecordTask label="Read Aloud" instructions="Record yourself reading the sentence exactly as written." prepSeconds={0} recordSeconds={20} timed={timed} resetKey={item.id} onComplete={onComplete}>
    <p className="text-xl font-bold leading-relaxed">{item.payload.prompt}</p>
  </PrepRecordTask>
}
export function ListenThenSpeak({ item, timed, onComplete }) {
  return <PrepRecordTask label="Listen Then Speak" instructions="Speak about the question you heard for up to 90 seconds." prepSeconds={20} recordSeconds={90} timed={timed} resetKey={item.id} onComplete={onComplete}>
    {phase => phase === 'prep' ? <RecordedAudio src={item.payload.audio} maxPlays={3} autoPlay /> : <p className="font-bold">Answer the question aloud. The question cannot be replayed during recording.</p>}
  </PrepRecordTask>
}
