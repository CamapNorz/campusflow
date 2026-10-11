export function toDate(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date : null
}

export function matchesSearch(task, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const text = [task.text, task.details, task.assignee, task.taskType].join(' ').toLocaleLowerCase()
  return terms.every(term => text.includes(term))
}

export function sortTasks(tasks, sort) {
  return [...tasks].sort((a, b) => {
    if (sort === 'deadline') return (toDate(a.deadlineAt)?.getTime() ?? Infinity) - (toDate(b.deadlineAt)?.getTime() ?? Infinity)
    if (sort === 'importance') return (b.importance ?? 3) - (a.importance ?? 3)
    return (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)
  })
}

export function getTimelineRange(tasks, today = new Date()) {
  const dates = tasks.flatMap(task => [task.startedAt, task.createdAt, task.deadlineAt, task.finishedAt].map(toDate).filter(Boolean))
  const first = dates.length ? new Date(Math.min(...dates.map(Number))) : today
  const last = dates.length ? new Date(Math.max(...dates.map(Number))) : today
  return { start: new Date(first.getFullYear(), first.getMonth(), 1), end: new Date(last.getFullYear(), last.getMonth() + 1, 1) }
}

export function validateSchedule(start, end) {
  if ((start && !toDate(start)) || (end && !toDate(end))) return '請輸入有效的日期與時間。'
  if (start && end && toDate(end) < toDate(start)) return '截止時間不能早於開始時間。'
  return ''
}

export function tasksToCsv(tasks) {
  const cell = value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const rows = [['任務', '詳細內容', '指派對象', '類型', '狀態', '重要度', '開始時間', '截止時間', '完成時間'], ...tasks.map(t => [t.text, t.details, t.assignee, t.taskType, ({todo:'未執行',doing:'執行中',done:'已完成'})[t.status] ?? t.status, t.importance, ...[t.startedAt,t.deadlineAt,t.finishedAt].map(d => toDate(d)?.toLocaleString('zh-TW', {hour12:false}) ?? '')])]
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}
