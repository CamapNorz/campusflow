import { toDate } from './tasks.js'

export const DAY = 86400000
export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
export const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate())
export const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate()+days)
export function parseDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y,m,d] = value.split('-').map(Number)
  const date = new Date(y,m-1,d)
  return dateKey(date) === value ? date : null
}
export function scheduledRows(tasks) {
  return tasks.map(task => {
    const startDate = toDate(task.startedAt) ?? toDate(task.createdAt)
    const endDate = toDate(task.deadlineAt) ?? toDate(task.finishedAt)
    return {task,startDate,endDate,startSource:toDate(task.startedAt)?'開始':'建立',endSource:toDate(task.deadlineAt)?'截止':'完成'}
  }).filter(row => row.startDate && row.endDate && row.endDate >= row.startDate)
}
export function automaticRange(rows, today = new Date()) {
  if (!rows.length) return {start:startOfDay(today),end:addDays(today,14)}
  const first = new Date(Math.min(...rows.map(row=>+row.startDate)))
  const last = new Date(Math.max(...rows.map(row=>+row.endDate)))
  return {start:addDays(first,-1),end:addDays(last,2)}
}
export function overlaps(row, start, end) {
  return +row.startDate === +row.endDate ? row.startDate >= start && row.startDate < end : row.endDate > start && row.startDate < end
}
export function barGeometry(row, start, end, width) {
  const duration = end-start
  const left = (Math.max(+row.startDate,+start)-start)/duration*width
  const right = (Math.min(+row.endDate,+end)-start)/duration*width
  return {left,width:Math.max(0,right-left),clippedStart:row.startDate<start,clippedEnd:row.endDate>end,milestone:+row.startDate===+row.endDate}
}
export function timelineTicks(start,end,scale,width) {
  const days=(end-start)/DAY
  let unit=scale
  if(scale==='fit') unit=days<=width/42?'day':days<=width/10?'week':'month'
  const ticks=[]
  let cursor=startOfDay(start)
  if(unit==='week') cursor=addDays(cursor,-((cursor.getDay()+6)%7))
  if(unit==='month') cursor=new Date(cursor.getFullYear(),cursor.getMonth(),1)
  const monthStep=unit==='month'?Math.max(1,Math.ceil(days/30/(width/80))):1
  while(cursor<end && ticks.length<2000){
    if(cursor>=start) ticks.push({date:new Date(cursor),label:unit==='month'?`${cursor.getFullYear()}/${cursor.getMonth()+1}`:`${cursor.getMonth()+1}/${cursor.getDate()}`})
    cursor=unit==='month'?new Date(cursor.getFullYear(),cursor.getMonth()+monthStep,1):addDays(cursor,unit==='week'?7:1)
  }
  return {ticks,unit,step:monthStep}
}
export function durationLabel(start,end) {
  const minutes=Math.round((end-start)/60000)
  if(!minutes)return '同一時間點'
  const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60
  return [days?`${days} 天`:'',hours?`${hours} 小時`:'',rest?`${rest} 分`:''].filter(Boolean).join(' ')
}

export function wrapTaskTitle(text, maxUnits=15) {
  const lines=[]
  let line='',units=0
  for(const char of Array.from(String(text || '未命名任務'))){
    const width=char.codePointAt(0)<=127?0.55:1
    if(char==='\n'||units+width>maxUnits){lines.push(line);line='';units=0}
    if(char!=='\n'){line+=char;units+=width}
  }
  if(line)lines.push(line)
  return lines.length?lines:['未命名任務']
}
