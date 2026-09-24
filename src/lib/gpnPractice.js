import samples from '../data/gpnSamples.json'

// Original booklet order, printed page numbers, and question numbering.
export const GPN_SECTIONS = [
  ['read_complete', 'Read and Complete', 3, 'readComplete', 180],
  ['read_select', 'Read and Select', 9, 'readSelect', 5],
  ['fill_blanks', 'Fill in the Blanks', 13, 'fillBlanks', 20],
  ['listen_type', 'Listen and Type', 16, 'listenType', 60],
  ['read_aloud', 'Read Aloud', 19, 'readAloud', 20],
  ['interactive_reading', 'Interactive Reading', 21, 'interactiveReading', 480],
  ['interactive_listening', 'Interactive Listening', 70, 'interactiveListening', 240],
  ['write_photo', 'Write About the Photo', 122, 'photos', 60],
  ['speak_photo', 'Speak About the Photo', 130, 'speakingPhotos', 110],
  ['interactive_writing', 'Interactive Writing', 138, 'interactiveWriting', 480],
  ['read_then_speak', 'Read Then Speak', 146, 'readThenSpeak', 110],
  ['listen_then_speak', 'Listen Then Speak', 149, 'listenThenSpeak', 110],
  ['writing_sample', 'Writing Sample', 151, 'writingSample', 300],
  ['speaking_sample', 'Speaking Sample', 154, 'speakingSample', 210],
].map(([type, label, page, bank, seconds]) => ({ type, label, page, bank, seconds, size: 1, count: samples[bank].length }))

export function gpnSection(type) {
  const section = GPN_SECTIONS.find(s => s.type === type)
  if (!section) throw new RangeError('Unknown GPN section')
  return section
}
export function gpnQuestions(type) { return samples[gpnSection(type).bank] }
export function gpnModels(type) {
  return samples.scoredExamples.filter(m => m.section === gpnSection(type).label.toUpperCase())
}
export function assembleGpnPractice(type, questionNo, followUpIndex = 0) {
  const section = gpnSection(type)
  if (!Number.isInteger(questionNo) || questionNo < 1 || questionNo > section.count) throw new RangeError('Unknown GPN question')
  const value = samples[section.bank][questionNo - 1]
  let payload = { ...value }
  if (type === 'read_select') payload = { number: value.number, items: [value] }
  if (['write_photo', 'speak_photo'].includes(type)) payload = { number: value.number, photo: value }
  if (type === 'read_then_speak') payload.prepSeconds = 20
  if (type === 'writing_sample') payload.prepSeconds = 30
  if (type === 'interactive_writing') {
    if (!Number.isInteger(followUpIndex) || !value.followUps[followUpIndex]) throw new RangeError('Unknown follow-up')
    payload.followUp = value.followUps[followUpIndex]
    payload.followUpIndex = followUpIndex
  }
  const suffix = type === 'interactive_writing' ? ` · Follow-up ${followUpIndex + 1}` : ''
  return {
    items: [{ id: `gpn_${type}_${questionNo}${type === 'interactive_writing' ? `_f${followUpIndex + 1}` : ''}`, type, source: 'gpn', payload, timeLimit: section.seconds }],
    title: `GPN · ${section.label} · Question ${questionNo}${suffix}`,
  }
}
