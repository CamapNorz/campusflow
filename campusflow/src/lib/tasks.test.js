import test from 'node:test'
import assert from 'node:assert/strict'
import { getTimelineRange, matchesSearch, sortTasks, tasksToCsv, toDate, validateSchedule } from './tasks.js'

test('search combines words across title, description and member; ignores case and whitespace', () => {
  const task = {text:'CampusFlow 首頁',details:'手機版 測試',assignee:'佳寧'}
  assert.ok(matchesSearch(task,' campusflow  佳寧 '))
  assert.ok(matchesSearch(task,'手機版'))
  assert.equal(matchesSearch(task,'柏翰'),false)
  assert.ok(matchesSearch({},''))
})
test('deadline sorting places unscheduled tasks last without mutating input', () => {
  const tasks=[{id:'none'},{id:'later',deadlineAt:'2026-10-03'},{id:'earlier',deadlineAt:{toDate:()=>new Date('2026-10-01')}}]
  assert.deepEqual(sortTasks(tasks,'deadline').map(t=>t.id),['earlier','later','none'])
  assert.equal(tasks[0].id,'none')
})
test('timeline includes dates outside the former hard-coded range and handles empty projects', () => {
  const {start,end}=getTimelineRange([{startedAt:'2030-02-15',deadlineAt:'2031-01-10'}])
  assert.equal(start.getFullYear(),2030);assert.equal(start.getMonth(),1)
  assert.equal(end.getFullYear(),2031);assert.equal(end.getMonth(),1)
  const empty=getTimelineRange([],new Date(2040,6,15));assert.equal(empty.start.getMonth(),6);assert.ok(empty.end>empty.start)
})
test('schedule allows optional dates and rejects reversed or invalid dates', () => {
  assert.equal(validateSchedule('',''),'')
  assert.equal(validateSchedule('2026-09-18T12:00','2026-09-18T12:00'),'')
  assert.match(validateSchedule('2026-09-20','2026-09-19'),/不能早於/)
  assert.match(validateSchedule('invalid',''),/有效/)
  assert.equal(toDate('invalid'),null)
})
test('CSV preserves multiline text and commas, escapes quotes and spreadsheet formulas', () => {
  const csv=tasksToCsv([{text:'=IMPORTXML("x")',details:'a,b\nc',assignee:' +command',status:'todo'}])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=IMPORTXML(""x"")"'))
  assert.ok(csv.includes('"a,b\nc"'))
  assert.ok(csv.includes('"\' +command"'))
  assert.ok(csv.includes('未執行'))
})
