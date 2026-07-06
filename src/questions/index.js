// Map of question type -> component. Every component follows the same
// contract: ({ item, timed, onComplete(response) }).

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
  fill_blanks: FillBlanks,
  read_complete: ReadComplete,
  interactive_reading: InteractiveReading,
  listen_type: ListenType,
  interactive_listening: InteractiveListening,
  write_photo: WritePhoto,
  interactive_writing: InteractiveWriting,
  writing_sample: WritingSample,
  speak_photo: SpeakPhoto,
  read_then_speak: ReadThenSpeak,
  interactive_speaking: InteractiveSpeaking,
  speaking_sample: SpeakingSample,
}
