export const LISTENING_SECONDS = 390
export const SUMMARY_SECONDS = 75

export function listeningSummaryItem(item) {
  return { ...item, id: `${item.id}:summary`, type: 'listening_summary', isSample: false,
    payload: { model: item.payload.summaryModel, prompt: `Summarize this conversation.\nScenario: ${item.payload.scenario}\n${item.payload.dialogue.map(t => `${t.speaker}: ${t.text}`).join('\n')}` } }
}

export function expandListeningSummaries(items, responses) {
  const expanded = [], answers = { ...responses }
  for (const item of items) {
    expanded.push(item)
    if (item.type === 'interactive_listening' && !items.some(other => other.id === `${item.id}:summary`) && typeof responses[item.id]?.summary === 'string') {
      const summary = listeningSummaryItem(item)
      expanded.push(summary)
      answers[summary.id] = { text: responses[item.id].summary }
    }
  }
  return { items: expanded, responses: answers }
}
