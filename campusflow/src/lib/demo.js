import { Timestamp } from 'firebase/firestore'

export function createDemoTasks() {
  const date = days => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(17, 0, 0, 0); return Timestamp.fromDate(d) }
  return [
    ['需求訪談與問題定義', '整理同學與指導老師的訪談紀錄，確認三個主要使用情境。', '小宇', 'done', -14, -9, 4],
    ['完成使用者流程圖', '從建立專題、加入小組到指派任務，畫出完整操作路徑。', '佳寧', 'done', -10, -5, 3],
    ['首頁介面與設計規範', '確認桌面與手機版的資訊層級，整理色彩與元件狀態。', '小宇', 'doing', -5, 2, 5],
    ['任務資料與權限串接', '驗證組長、組員與老師能存取的資料範圍。', '柏翰', 'doing', -4, 4, 5],
    ['第一次進度簡報', '準備研究背景、系統架構與目前完成的畫面。', '全員', 'todo', -2, 1, 4],
    ['整理參考資料', '補上論文引用與競品分析的資料來源。', '佳寧', 'todo', -6, -1, 2],
    ['手機版操作測試', '以真實裝置驗證新增任務、日期選擇與導覽。', '柏翰', 'todo', 3, 8, 3],
    ['期中展示與回饋整理', '記錄展示回饋並排定下一輪改善項目。', '全員', 'todo', 9, 14, 4],
  ].map(([text,details,assignee,status,start,end,importance], i) => ({id:`demo-${i}`,text,details,assignee,status,importance,taskType:'畢業專題',createdBy:'demo-user',createdAt:date(start-1),startedAt:date(start),deadlineAt:date(end),finishedAt:status==='done'?date(end):null,done:status==='done'}))
}

export function createDemoUser(role = 'leader') {
  return {uid:'demo-user',name:'小宇',role,isLeader:role==='leader',isTeacher:role==='teacher',groupId:'DEMO-2026',groupName:'CampusFlow 專題工作室',teacherStatus:'approved'}
}
