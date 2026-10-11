import Icon from './Icon'
import { toDate, sortTasks } from '../lib/tasks'

export default function Overview({tasks, user, members, onNavigate, onTask, weeklyMvp, doneThisWeek, totalThisWeek}) {
  const now = new Date()
  const done = tasks.filter(t=>t.status==='done').length
  const overdue = tasks.filter(t=>t.status!=='done' && toDate(t.deadlineAt) && toDate(t.deadlineAt)<now)
  const upcoming = sortTasks(tasks.filter(t=>t.status!=='done' && toDate(t.deadlineAt)), 'deadline').slice(0,4)
  const percent = tasks.length ? Math.round(done/tasks.length*100) : 0
  return <section className="overview">
    <div className="project-summary">
      <div className="summary-intro"><h2>專題進度</h2><p>{tasks.length ? `共 ${tasks.length} 項任務，${tasks.length-done} 項尚未完成。` : '尚未建立任務。請使用「新增任務」開始安排分工。'}</p><button className="text-action" onClick={()=>onNavigate('gantt')}>查看專題時程 <Icon name="arrow" size={16}/></button></div>
      <div className="summary-progress"><div><span>整體完成進度</span><strong>{percent}<small>%</small></strong></div><div className="progress-track" role="progressbar" aria-label="專題完成進度" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${percent}%`}}/></div><p>{done} / {tasks.length} 項任務已完成</p></div>
    </div>
    <div className="summary-strip">
      <button onClick={()=>onNavigate('tasks')}><Icon name="tasks"/><span>待完成<strong>{tasks.length-done}<small> 項</small></strong></span></button>
      <button onClick={()=>onNavigate('overdue')} className={overdue.length?'attention':''}><Icon name="clock"/><span>已逾期<strong>{overdue.length}<small> 項需留意</small></strong></span></button>
      <div><Icon name="check"/><span>本週完成<strong>{doneThisWeek}<small> / {totalThisWeek} 項</small></strong></span></div>
      <button onClick={()=>onNavigate('leaderboard')}><Icon name="award"/><span>本週 MVP<strong className="person-value">{weeklyMvp?.completed?weeklyMvp.member:'尚待累積'}<small>{weeklyMvp?.completed?` · ${weeklyMvp.completed} 項`:''}</small></strong></span></button>
    </div>
    <div className="overview-columns">
      <section className="due-panel"><div className="section-title"><h2>近期截止任務</h2><button className="text-action" onClick={()=>onNavigate('calendar')}>行事曆 <Icon name="arrow" size={16}/></button></div>
        {upcoming.length ? <div className="due-list">{upcoming.map(task=>{const date=toDate(task.deadlineAt);const late=date<now;return <button key={task.id} className="due-row" onClick={()=>onTask(task)}><span className={`due-date ${late?'late':''}`}><small>{date.getMonth()+1} 月</small><strong>{date.getDate()}</strong></span><span className="due-task"><strong>{task.text}</strong><small>{task.assignee} · {task.taskType}</small></span><span className={`status-label ${late?'late':task.status}`}>{late?'已逾期':task.status==='doing'?'執行中':'未執行'}</span><Icon name="arrow" size={16}/></button>})}</div>:<div className="empty-message"><Icon name="check"/><h3>目前沒有待辦截止事項</h3><p>新增任務並設定日期，就會出現在這裡。</p></div>}
      </section>
      <section className="team-panel"><div className="section-title"><h2>成員任務統計</h2><span>{members.length} 位成員</span></div><div className="team-list">{members.map((name,index)=>{const owned=tasks.filter(t=>t.assignee===name||t.assignee==='全員');const completed=owned.filter(t=>t.status==='done').length;return <div className="member-row" key={name}><span className={`avatar avatar-${index%3}`}>{Array.from(name)[0]}</span><div><strong>{name}{name===user?.name?<small> · 你</small>:null}</strong><p>{owned.length-completed} 項待完成</p></div><span className="member-count">{completed}/{owned.length}</span></div>})}{!members.length?<p className="empty-message">尚無組員。可使用空間代碼邀請組員加入。</p>:null}</div><p className="team-note">數字表示已完成／指派任務數，包含全員任務。</p></section>
    </div>
  </section>
}
