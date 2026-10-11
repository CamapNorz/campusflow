import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { DAY, addDays, automaticRange, barGeometry, dateKey, durationLabel, overlaps, parseDateInput, timelineTicks, wrapTaskTitle } from '../lib/gantt'
import '../gantt.css'

const STATUS = {todo:'未執行',doing:'執行中',done:'已完成'}
const COLORS = {'bg-amber-600':'#b87917','bg-emerald-700':'#427767','bg-slate-700':'#53647e','bg-rose-700':'#b33b54','bg-indigo-700':'#506bc1'}
const DATE_FORMAT = new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit'})
const TIME_FORMAT = new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})
const stamp = date => `${DATE_FORMAT.format(date)} ${TIME_FORMAT.format(date)}`
const shorten = (text, count=19) => Array.from(text || '').length>count ? Array.from(text).slice(0,count-1).join('')+'…' : text

function saveBlob(blob, filename) {
  const url=URL.createObjectURL(blob)
  const anchor=document.createElement('a')
  anchor.href=url;anchor.download=filename;anchor.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export default function GanttChart({items, taskCount, projectName, demo, members, filters, onFilter, colors, colorOptions, onColor, onMove, getColor, matchesAssignee, getDeadlineTone}) {
  const [scale,setScale]=useState('fit')
  const [range,setRange]=useState({start:'',end:''})
  const [presentation,setPresentation]=useState(false)
  const [selectedId,setSelectedId]=useState(null)
  const [exporting,setExporting]=useState(false)
  const [notice,setNotice]=useState('')
  const [containerWidth,setContainerWidth]=useState(1120)
  const [now,setNow]=useState(()=>new Date())
  const wrapperRef=useRef(null)
  const svgRef=useRef(null)
  const presentButtonRef=useRef(null)
  const exportLock=useRef(false)

  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return ()=>clearInterval(timer)},[])

  const filtered=items.filter(({task})=>matchesAssignee(task,filters.assignee) && (filters.status==='all'||task.status===filters.status) && (filters.deadlineTone==='all'||getDeadlineTone(task)===filters.deadlineTone))
  const autoRange=automaticRange(filtered,now)
  const startInput=range.start || dateKey(autoRange.start)
  const endInput=range.end || dateKey(addDays(autoRange.end,-1))
  const rangeStart=parseDateInput(startInput)
  const lastDay=parseDateInput(endInput)
  const rangeEnd=lastDay ? addDays(lastDay,1) : null
  const rangeError=!rangeStart||!rangeEnd ? '請輸入完整有效的起訖日期。' : rangeEnd<=rangeStart ? '顯示迄日不能早於起日。' : ''
  const start=rangeStart || autoRange.start
  const end=rangeEnd && rangeEnd>start ? rangeEnd : autoRange.end
  const dayCount=(end-start)/DAY
  const leftWidth=450
  const minWidth=Math.max(1040,Math.floor(containerWidth)-2)
  const requestedWidth=scale==='fit'?minWidth:Math.max(minWidth,leftWidth+dayCount*({day:48,week:20,month:6})[scale]+24)
  const layoutError=requestedWidth>12000 ? '目前區間過長，請縮短日期，或改用「月」／「配合寬度」。' : rangeError
  useEffect(()=>{
    const node=wrapperRef.current
    if(!node)return
    const observer=new ResizeObserver(entries=>setContainerWidth(entries[0].contentRect.width))
    observer.observe(node)
    return ()=>observer.disconnect()
  },[presentation,layoutError])
  const chartWidth=Math.min(12000,requestedWidth)
  const plotWidth=chartWidth-leftWidth-24
  const {ticks,unit,step}=timelineTicks(start,end,scale,plotWidth)
  const rows=filtered.filter(row=>overlaps(row,start,end))
  const bodyTop=148
  const rowLayouts=rows.reduce((layouts,row)=>{
    const titleLines=wrapTaskTitle(row.task.text)
    const height=Math.max(66,titleLines.length*18+34)
    const previous=layouts.at(-1)
    layouts.push({...row,titleLines,y:previous?previous.y+previous.height:bodyTop,height})
    return layouts
  },[])
  const lastRow=rowLayouts.at(-1)
  const bodyBottom=lastRow?lastRow.y+lastRow.height:bodyTop+66
  const chartHeight=bodyBottom+106
  const x=date=>leftWidth+(date-start)/(end-start)*plotWidth
  const selected=rows.find(row=>row.task.id===selectedId)
  const missing=Math.max(0,taskCount-items.length)
  const todayVisible=now>=start && now<end
  const months=[]
  for(let date=new Date(start.getFullYear(),start.getMonth(),1);date<end && months.length<2400;date=new Date(date.getFullYear(),date.getMonth()+1,1)){
    const next=new Date(date.getFullYear(),date.getMonth()+1,1)
    months.push({date,left:Math.max(leftWidth,x(date)),right:Math.min(leftWidth+plotWidth,x(next))})
  }
  const weekends=[]
  if(dayCount<=370)for(let date=new Date(start);date<end;date=addDays(date,1))if(date.getDay()===0||date.getDay()===6)weekends.push({left:x(date),width:x(addDays(date,1))-x(date)})
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone
  const filterText=`對象：${filters.assignee==='all'?'全部':filters.assignee} / 狀態：${STATUS[filters.status] || '全部'} / 期限：${({all:'全部',soon:'即將到期',overdue:'已逾期'})[filters.deadlineTone]}`

  const closePresentation=()=>{setPresentation(false);requestAnimationFrame(()=>presentButtonRef.current?.focus())}
  const exportChart=async format=>{
    if(exportLock.current||layoutError||!svgRef.current)return
    exportLock.current=true;setExporting(true);setNotice('')
    let imageUrl
    try{
      await document.fonts.ready
      const clone=svgRef.current.cloneNode(true)
      clone.querySelectorAll('[tabindex]').forEach(node=>node.removeAttribute('tabindex'))
      const xml=new XMLSerializer().serializeToString(clone)
      const blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'})
      const filename=`CampusFlow-Gantt-${startInput}-${endInput}`
      if(format==='svg'){saveBlob(blob,filename+'.svg');setNotice('SVG 已匯出，可放大或插入簡報。');return}
      const factor=Math.min(2,8192/chartWidth,8192/chartHeight)
      if(factor<0.75)throw new Error('圖表過大，請縮短區間、篩選任務，或匯出 SVG。')
      imageUrl=URL.createObjectURL(blob)
      const image=new Image()
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('圖檔轉換失敗，請改用 SVG 匯出。'));image.src=imageUrl})
      const canvas=document.createElement('canvas')
      canvas.width=Math.ceil(chartWidth*factor);canvas.height=Math.ceil(chartHeight*factor)
      const context=canvas.getContext('2d')
      if(!context)throw new Error('此瀏覽器無法輸出 PNG，請改用 SVG。')
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height)
      context.drawImage(image,0,0,canvas.width,canvas.height)
      const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))
      if(!png)throw new Error('PNG 匯出失敗，請改用 SVG。')
      saveBlob(png,filename+'.png');setNotice(`PNG 已匯出（${canvas.width} × ${canvas.height}），包含完整任務列。`)
    }catch(error){setNotice(error.message)}finally{
      if(imageUrl)URL.revokeObjectURL(imageUrl)
      exportLock.current=false;setExporting(false)
    }
  }

  const exportButtons=<><button className="secondary-button" disabled={exporting||!!layoutError} onClick={()=>exportChart('png')}><Icon name="download" size={16}/>{exporting?'處理中…':'匯出 PNG'}</button><button className="secondary-button" disabled={exporting||!!layoutError} onClick={()=>exportChart('svg')}>匯出 SVG</button></>
  const scaleControl=<label className="gantt-field"><span>時間尺度</span><select aria-label="時間尺度" value={scale} onChange={e=>setScale(e.target.value)}><option value="fit">配合寬度</option><option value="day">日</option><option value="week">週</option><option value="month">月</option></select></label>
  const rowLabels=row=>{
    const {task,startDate,endDate,y,height,titleLines}=row
    const middle=y+height/2
    return <g key={task.id}>
      <text x="26" y={y+24} fontSize="13" fontWeight="600" fill="#26344b">{titleLines.map((line,index)=><tspan x="26" dy={index?18:0} key={index}>{line}</tspan>)}</text>
      <text x="26" y={y+24+(titleLines.length-1)*18+20} fontSize="11" fill="#53647e">{shorten(task.assignee,8)} · {STATUS[task.status] || task.status}</text>
      <text x="245" y={middle-7} fontSize="11" fill="#344760">{DATE_FORMAT.format(startDate)}</text>
      <text x="245" y={middle+12} fontSize="11" fill="#53647e">{TIME_FORMAT.format(startDate)}{row.startSource==='建立'?' †':''}</text>
      <text x="345" y={middle-7} fontSize="11" fill="#344760">{DATE_FORMAT.format(endDate)}</text>
      <text x="345" y={middle+12} fontSize="11" fill="#53647e">{TIME_FORMAT.format(endDate)}{row.endSource==='完成'?' †':''}</text>
    </g>
  }
  const report=<svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="group" aria-label="專題甘特圖，依實際時間比例繪製" style={{fontFamily:'Microsoft JhengHei, Arial, sans-serif'}}>
    <rect width={chartWidth} height={chartHeight} fill="#fff"/>
    <text x="24" y="33" fontSize="21" fontWeight="700" fill="#26344b">{shorten(projectName || '專題時程',45)} · 甘特圖</text>
    <text x="24" y="58" fontSize="12" fill="#53647e">{`${startInput} 至 ${endInput}（含迄日） · ${rows.length} 項任務 · ${timezone}${demo?' · 示範資料':''}`}</text>
    <text x="24" y="81" fontSize="12" fill="#53647e">{filterText.replaceAll('\u3000','  ')}</text>
    <rect x="16" y="99" width={chartWidth-32} height="49" rx="4" fill="#eef2f8"/>
    <text x="26" y="129" fontSize="12" fontWeight="700" fill="#344760">任務 / 負責人 / 狀態</text>
    <text x="245" y="129" fontSize="12" fontWeight="700" fill="#344760">開始時間</text>
    <text x="345" y="129" fontSize="12" fontWeight="700" fill="#344760">截止時間</text>
    {months.map(({date,left,right},index)=><g key={+date}><rect x={left} y="99" width={Math.max(0,right-left)} height="22" fill={index%2?'#e3e9f3':'#eef2f8'}/>{right-left>28?<text x={(left+right)/2} y="115" textAnchor="middle" fontSize="11" fill="#435674">{right-left>65?`${date.getFullYear()}/${date.getMonth()+1}`:`${date.getMonth()+1}月`}</text>:null}</g>)}
    {weekends.map((band,index)=><rect key={index} x={band.left} y={bodyTop} width={band.width} height={bodyBottom-bodyTop} fill="#f5f7fa"/>)}
    {ticks.map(tick=><g key={+tick.date}><line x1={x(tick.date)} x2={x(tick.date)} y1="122" y2={bodyBottom} stroke="#e0e6ef"/>{x(tick.date)<chartWidth-52?<text x={x(tick.date)+5} y="139" fontSize="11" fill="#53647e">{unit==='month'?`${tick.date.getMonth()+1}月`:tick.label}</text>:null}</g>)}
    {rowLayouts.map(row=>{
      const {task,startDate,endDate,y,height}=row
      const middle=y+height/2
      const geometry=barGeometry(row,start,end,plotWidth)
      const color=COLORS[getColor(task)] || '#53647e'
      const label=`${task.text}；${task.assignee}；${STATUS[task.status]}；${row.startSource} ${stamp(startDate)}；${row.endSource} ${stamp(endDate)}；${durationLabel(startDate,endDate)}`
      return <g key={task.id} className="gantt-svg-row" tabIndex={0} role="button" aria-label={label} onClick={()=>setSelectedId(task.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedId(task.id)}}}>
        <title>{label}</title>
        <rect className="gantt-row-hit" x="16" y={y} width={chartWidth-32} height={height} fill="transparent"/>
        <line x1="16" x2={chartWidth-16} y1={y+height} y2={y+height} stroke="#e4e8ef"/>
        {rowLabels(row)}
        {geometry.milestone?<path d={`M ${leftWidth+geometry.left} ${middle-9} l 7 9 -7 9 -7 -9 Z`} fill={color}/>:<rect x={leftWidth+geometry.left} y={middle-9} width={geometry.width} height="18" rx="2" fill={color}/>}
        {geometry.clippedStart?<path d={`M ${leftWidth+6} ${middle-6} l -4 6 4 6`} fill="none" stroke="#fff" strokeWidth="1.5"/>:null}
        {geometry.clippedEnd?<path d={`M ${leftWidth+plotWidth-6} ${middle-6} l 4 6 -4 6`} fill="none" stroke="#fff" strokeWidth="1.5"/>:null}
      </g>
    })}
    {!rows.length?<text x={chartWidth/2} y={bodyTop+38} textAnchor="middle" fontSize="14" fill="#657084">此區間沒有符合條件的排程任務</text>:null}
    {todayVisible?<g><line x1={x(now)} x2={x(now)} y1={bodyTop} y2={bodyBottom} stroke="#c04959" strokeWidth="1.5" strokeDasharray="5 4"/><circle cx={x(now)} cy={bodyTop} r="3" fill="#c04959"/></g>:null}
    <text x="24" y={bodyBottom+25} fontSize="11" fill="#53647e">{`刻度：${unit==='month' && step>1 ? `每 ${step} 個月` : ({day:'每日',week:'每週一',month:'每月'})[unit]} · 長度按實際時間計算；◆ 表示相同起訖時間；箭頭表示超出顯示區間。`}</text>
    <text x="24" y={bodyBottom+46} fontSize="11" fill="#53647e">† 未填開始時採建立時間，未填截止時採完成時間。淺灰底為週末；紅色虛線為現在。</text>
    <text x="24" y={bodyBottom+67} fontSize="11" fill="#53647e">{`${missing} 項缺少有效日期或日期反向 · ${filtered.length-rows.length} 項在區間外 · 更新：${stamp(now)}`}</text>
    <text x={chartWidth-24} y={bodyBottom+88} textAnchor="end" fontSize="11" fill="#657084">CampusFlow</text>
  </svg>

  const chart=<div className="gantt-chart-shell" ref={wrapperRef}><div className="gantt-chart-scroll" tabIndex={0} role="region" aria-label="可橫向捲動的甘特圖">
    <div className="gantt-frozen-columns" aria-hidden="true" inert><div style={{height:bodyBottom-99}}><svg width={leftWidth} height={bodyBottom-99} viewBox={`0 99 ${leftWidth} ${bodyBottom-99}`} style={{fontFamily:'Microsoft JhengHei, Arial, sans-serif'}}>
      <rect x="0" y="99" width={leftWidth} height={bodyBottom-99} fill="#fff"/><rect x="16" y="99" width={leftWidth-16} height="49" fill="#eef2f8"/>
      <text x="26" y="129" fontSize="12" fontWeight="700" fill="#344760">任務 / 負責人 / 狀態</text><text x="245" y="129" fontSize="12" fontWeight="700" fill="#344760">開始時間</text><text x="345" y="129" fontSize="12" fontWeight="700" fill="#344760">截止時間</text>
      {rowLayouts.map(row=><g key={row.task.id}>{rowLabels(row)}<line x1="16" x2={leftWidth} y1={row.y+row.height} y2={row.y+row.height} stroke="#e4e8ef"/></g>)}
    </svg></div></div>{report}</div></div>
  return <section className="gantt-workspace" aria-label="甘特圖工作區">
    <div className="gantt-settings">
      <div className="gantt-filter-row">
        <label className="gantt-field"><span>負責人</span><select aria-label="甘特圖指派對象" value={filters.assignee} onChange={e=>onFilter('assignee',e.target.value)}><option value="all">全部</option>{members.map(name=><option key={name}>{name}</option>)}</select></label>
        <label className="gantt-field"><span>執行狀態</span><select aria-label="甘特圖執行狀態" value={filters.status} onChange={e=>onFilter('status',e.target.value)}><option value="all">全部</option>{Object.entries(STATUS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
        <label className="gantt-field"><span>截止狀態</span><select aria-label="甘特圖截止狀態" value={filters.deadlineTone} onChange={e=>onFilter('deadlineTone',e.target.value)}><option value="all">全部</option><option value="soon">即將到期</option><option value="overdue">已逾期</option></select></label>
        <div className="gantt-export-actions">{exportButtons}<button className="primary-button" ref={presentButtonRef} disabled={!!layoutError} onClick={()=>{setNotice('');setPresentation(true)}}>提報模式</button></div>
      </div>
      <div className="gantt-range-row">
        <label className="gantt-field"><span>顯示起日</span><input type="date" aria-label="顯示起日" value={startInput} onChange={e=>setRange({...range,start:e.target.value})}/></label>
        <label className="gantt-field"><span>顯示迄日（包含當天）</span><input type="date" aria-label="顯示迄日" value={endInput} onChange={e=>setRange({...range,end:e.target.value})}/></label>
        {scaleControl}
        <button className="secondary-button" onClick={()=>{setRange({start:'',end:''});setScale('fit')}}>配合任務範圍</button>
      </div>
      <p className="gantt-help">顯示「畢業專題」類型任務。寬圖可左右捲動；點選任務列查看詳細時間。匯出包含完整任務列。</p>
    </div>
    {layoutError?<p className="feedback error" role="alert">{layoutError}</p>:null}
    {notice && !presentation?<p role="status" className="gantt-notice">{notice}</p>:null}
    {!presentation && !layoutError?chart:null}
    {selected && !presentation?<div className="gantt-detail" role="status"><strong>{selected.task.text}</strong><span>{selected.task.assignee} · {STATUS[selected.task.status]}</span><span>{selected.startSource}：{stamp(selected.startDate)}</span><span>{selected.endSource}：{stamp(selected.endDate)}</span><span>期間：{durationLabel(selected.startDate,selected.endDate)}</span></div>:null}
    <details className="gantt-row-settings"><summary>任務順序與顏色 <span>{items.length} 項已排程</span></summary><div className="gantt-order-list">{items.map(({task},index)=><div key={task.id}><span title={task.text}>{task.text}</span><button aria-label={`${task.text} 上移`} disabled={index===0} onClick={()=>onMove(task.id,-1)}>↑</button><button aria-label={`${task.text} 下移`} disabled={index===items.length-1} onClick={()=>onMove(task.id,1)}>↓</button><select aria-label={`${task.text} 的甘特圖顏色`} value={colors[task.id] || ''} onChange={e=>onColor(task.id,e.target.value)}><option value="">自動</option>{colorOptions.map(color=><option value={color.value} key={color.value}>{color.label}</option>)}</select></div>)}</div></details>
    {presentation?<dialog className="gantt-presentation" aria-label="甘特圖提報模式" ref={node=>{if(node&&!node.open)node.showModal()}} onCancel={closePresentation}>
      <div className="gantt-present-toolbar"><strong>甘特圖提報</strong>{scaleControl}<div>{exportButtons}<button className="secondary-button" onClick={closePresentation}><Icon name="close" size={16}/>結束提報</button></div></div>
      {notice?<p className="gantt-notice" role="status">{notice}</p>:null}
      {layoutError?<p role="alert">{layoutError}</p>:chart}
      {selected?<div className="gantt-detail" role="status"><strong>{selected.task.text}</strong><span>{stamp(selected.startDate)} → {stamp(selected.endDate)}</span><span>期間：{durationLabel(selected.startDate,selected.endDate)}</span></div>:null}
    </dialog>:null}
  </section>
}
