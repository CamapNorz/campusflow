import test from 'node:test'
import assert from 'node:assert/strict'
import {scheduledRows,barGeometry,overlaps,parseDateInput,automaticRange,timelineTicks,wrapTaskTitle,DAY} from './gantt.js'

test('preserves hours and minutes without rounding deadline up a day',()=>{
  const [row]=scheduledRows([{startedAt:'2026-09-18T09:30:00',deadlineAt:'2026-09-18T10:15:00'}])
  const start=new Date(2026,8,18),end=new Date(2026,8,19)
  const bar=barGeometry(row,start,end,1440)
  assert.equal(bar.left,570);assert.equal(bar.width,45)
})
test('partially visible tasks remain visible and clip exactly at the range edges',()=>{
  const [row]=scheduledRows([{startedAt:'2026-09-01',deadlineAt:'2026-09-30'}])
  const start=new Date('2026-09-10'),end=new Date('2026-09-20')
  assert.ok(overlaps(row,start,end))
  assert.deepEqual(barGeometry(row,start,end,1000),{left:0,width:1000,clippedStart:true,clippedEnd:true,milestone:false})
})
test('very short tasks keep their real width; same-time tasks use a milestone',()=>{
  const start=new Date(2026,0,1),end=new Date(+start+DAY)
  const [short,point]=scheduledRows([{startedAt:start,deadlineAt:new Date(+start+60000)},{startedAt:start,deadlineAt:start}])
  assert.ok(barGeometry(short,start,end,100).width<1)
  assert.ok(barGeometry(point,start,end,100).milestone)
  assert.ok(overlaps(point,start,end))
})
test('missing and reversed schedules are excluded; fallback provenance is retained',()=>{
  const rows=scheduledRows([{createdAt:'2030-02-01',finishedAt:'2030-02-02'}, {startedAt:'2030-02-02',deadlineAt:'2030-02-01'},{}])
  assert.equal(rows.length,1);assert.equal(rows[0].startSource,'建立');assert.equal(rows[0].endSource,'完成')
  assert.ok(automaticRange(rows).start<rows[0].startDate)
})
test('calendar input validates leap dates and weekly ticks start on Monday',()=>{
  assert.equal(parseDateInput('2026-02-29'),null)
  assert.ok(parseDateInput('2028-02-29'))
  const {ticks}=timelineTicks(new Date(2026,8,1),new Date(2026,9,1),'week',1000)
  assert.ok(ticks.length);assert.ok(ticks.every(t=>t.date.getDay()===1))
})

test('multi-year tick sampling reports its real interval',()=>{
  const {ticks,step}=timelineTicks(new Date(2026,0,1),new Date(2030,0,1),'month',600)
  assert.ok(step>1)
  const monthNumber=date=>date.getFullYear()*12+date.getMonth()
  assert.equal(monthNumber(ticks[1].date)-monthNumber(ticks[0].date),step)
})

test('long task titles wrap without omitting content from the exported report',()=>{
  const title='完成畢業專題管理系統的使用者訪談與權限設定測試 CampusFlow integration'
  const lines=wrapTaskTitle(title)
  assert.ok(lines.length>1)
  assert.equal(lines.join(''),title)
})
