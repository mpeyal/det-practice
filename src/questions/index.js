// Map of question type -> component. Every component follows the same
// contract: ({ item, timed, onComplete(response) }).

import GpnListening from './GpnListening.jsx'
import { ReadAloud, ListenThenSpeak } from './GpnSpeaking.jsx'
import React from 'react'
import ReadSelect from './ReadSelect.jsx'
import FillBlanks from './FillBlanks.jsx'
import ReadComplete from './ReadComplete.jsx'
import InteractiveReading from './InteractiveReading.jsx'
import ListenType from './ListenType.jsx'
import InteractiveListening from './InteractiveListening.jsx'
import { WritePhoto, InteractiveWriting, WritingSample } from './WritingTasks.jsx'
import { SpeakPhoto, ReadThenSpeak, InteractiveSpeaking, SpeakingSample } from './SpeakingTasks.jsx'

export const QUESTION_COMPONENTS = {
  read_select: ReadSelect,
  read_aloud: ReadAloud,
  listen_then_speak: ListenThenSpeak,
  fill_blanks: FillBlanks,
  read_complete: ReadComplete,
  interactive_reading: InteractiveReading,
  listen_type: ListenType,
  interactive_listening: props => React.createElement(props.item.payload.gpnConversation ? GpnListening : InteractiveListening, props),
  write_photo: WritePhoto,
  interactive_writing: InteractiveWriting,
  writing_sample: WritingSample,
  speak_photo: SpeakPhoto,
  read_then_speak: ReadThenSpeak,
  interactive_speaking: InteractiveSpeaking,
  speaking_sample: SpeakingSample,
}
