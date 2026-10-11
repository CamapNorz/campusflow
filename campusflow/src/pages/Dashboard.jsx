import { useEffect, useRef, useState } from "react"
import "../firebase"
import {
    addDoc,
    collection,
    getDoc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    updateDoc,
    doc,
    Timestamp,
    deleteDoc,
    setDoc,
} from "firebase/firestore"
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    signOut,
} from "firebase/auth"

import Icon from "../components/Icon"
import Overview from "../components/Overview"
import FileGuidelines from "../components/FileGuidelines"
import DriveDirectory from "../components/DriveDirectory"
import GanttChart from "../components/GanttChart"
import { scheduledRows } from "../lib/gantt"
import { createDemoTasks, createDemoUser } from "../lib/demo"
import { matchesSearch, sortTasks, validateSchedule, tasksToCsv } from "../lib/tasks"
import "../workspace.css"

const BASE_MEMBER_OPTIONS = []
const ALL_ASSIGNEE = "全員"
const TASK_TYPE_OPTIONS = ["小作業", "期中作業", "期末作業", "畢業專題", "其他"]
const STATUS_LABELS = {
    todo: "未執行",
    doing: "執行中",
    done: "已完成",
}
const IMPORTANCE_OPTIONS = [1, 2, 3, 4, 5]
const DAY_MS = 24 * 60 * 60 * 1000
const GANTT_COLOR_OPTIONS = [
    { label: "銅", value: "bg-amber-600" },
    { label: "苔", value: "bg-emerald-700" },
    { label: "墨", value: "bg-slate-700" },
    { label: "酒", value: "bg-rose-700" },
    { label: "鳶", value: "bg-indigo-700" },
]

export default function Dashboard({ demo = false, demoRole = "leader" }) {
    const [currentUser, setCurrentUser] = useState(() => demo ? createDemoUser(demoRole) : null)
    const [loginName, setLoginName] = useState("")
    const [loginRole, setLoginRole] = useState("member")
    const [projectNameInput, setProjectNameInput] = useState("")
    const [groupCodeInput, setGroupCodeInput] = useState("")
    const [copiedGroupCode, setCopiedGroupCode] = useState(false)
    const [copiedLoginUrl, setCopiedLoginUrl] = useState(false)
    const [loginError, setLoginError] = useState("")
    const [authReady, setAuthReady] = useState(demo)
    const [isEditingName, setIsEditingName] = useState(false)
    const [nameDraft, setNameDraft] = useState("")
    const [nameError, setNameError] = useState("")
    const [issueReportText, setIssueReportText] = useState("")
    const [issueReportStatus, setIssueReportStatus] = useState("")
    const [teacherGroupCodeInput, setTeacherGroupCodeInput] = useState("")
    const [teacherJoinError, setTeacherJoinError] = useState("")
    const [input, setInput] = useState("")
    const [detailsInput, setDetailsInput] = useState("")
    const [assigneeInput, setAssigneeInput] = useState(currentUser?.name ?? BASE_MEMBER_OPTIONS[0])
    const [importanceInput, setImportanceInput] = useState(3)
    const [taskScheduleType, setTaskScheduleType] = useState("小作業") // 小作業 | 期中作業 | 期末作業 | 畢業專題 | 其他
    const [startInput, setStartInput] = useState("")
    const [deadlineInput, setDeadlineInput] = useState("")
    const [editTaskId, setEditTaskId] = useState(null)
    const [editText, setEditText] = useState("")
    const [editDetails, setEditDetails] = useState("")
    const [editAssignee, setEditAssignee] = useState(currentUser?.name ?? BASE_MEMBER_OPTIONS[0])
    const [editImportance, setEditImportance] = useState(3)
    const [editTaskType, setEditTaskType] = useState("其他")
    const [editStartInput, setEditStartInput] = useState("")
    const [editDeadlineInput, setEditDeadlineInput] = useState("")
    const [editFinishedInput, setEditFinishedInput] = useState("")
    const [editError, setEditError] = useState(null)
    const [tasks, setTasks] = useState(() => demo ? createDemoTasks() : [])
    const [tasksError, setTasksError] = useState(null)
    const [activePage, setActivePage] = useState(() => {
        const view = new URLSearchParams(window.location.search).get("view")
        return ["tasks", "calendar", "gantt", "leaderboard", "files", "drive"].includes(view) ? view : "dashboard"
    })
    const [calendarCursor, setCalendarCursor] = useState(() => new Date())
    const [selectedDateKey, setSelectedDateKey] = useState(null)
    const [expandedTaskIds, setExpandedTaskIds] = useState({})
    const [ganttOrder, setGanttOrder] = useState(() => {
        if (typeof window === "undefined") return []
        try {
            const stored = JSON.parse(window.localStorage.getItem("ganttOrder") ?? "[]")
            return Array.isArray(stored) ? stored : []
        } catch {
            return []
        }
    })
    const [ganttColors, setGanttColors] = useState(() => {
        if (typeof window === "undefined") return {}
        try {
            const stored = JSON.parse(window.localStorage.getItem("ganttColors") ?? "{}")
            return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {}
        } catch {
            return {}
        }
    })
    const [ganttFilters, setGanttFilters] = useState({
        assignee: "all",
        deadlineTone: "all",
        status: "all",
    })
    const [taskFilters, setTaskFilters] = useState({
        assignee: "all",
        taskType: "all",
        deadlineTone: "all",
        status: "all",
    })
    const db = getFirestore()
    const auth = getAuth()
    const [authUser, setAuthUser] = useState(null)
    const [userProfile, setUserProfile] = useState(null)
    const [currentGroup, setCurrentGroup] = useState(null)
    const [teamUsers, setTeamUsers] = useState(() => demo ? ["小宇", "佳寧", "柏翰"].map(name => ({name})) : [])
    const [membershipReady, setMembershipReady] = useState(demo)
    const [searchQuery, setSearchQuery] = useState("")
    const [sortOrder, setSortOrder] = useState("deadline")
    const [showComposer, setShowComposer] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [actionMessage, setActionMessage] = useState("")
    const [actionError, setActionError] = useState("")
    const [busy, setBusy] = useState(false)
    const actionLock = useRef(false)
    const titleRef = useRef(null)
    const [clockNow, setClockNow] = useState(() => new Date())
    const [profileReady, setProfileReady] = useState(demo)
    const userAgent =
        typeof navigator === "undefined" ? "" : navigator.userAgent
    const isEmbeddedBrowser =
        /Line|FBAN|FBAV|Instagram|Messenger|MicroMessenger|wv|WebView/i.test(
            userAgent
        )

    // Existing Firebase subscription reset and identity synchronization are intentionally retained.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (demo) return
        if (!currentUser?.groupId || !membershipReady) {
            setTasks([])
            setTasksError(null)
            return
        }

        const tasksRef = collection(db, "groups", currentUser.groupId, "tasks")

        const unsubscribe = onSnapshot(
            tasksRef,
            (snapshot) => {
                const taskList = snapshot.docs.map((taskDoc) => {
                const data = taskDoc.data()

                // Backward compatibility:
                // Old tasks might only have `done` (boolean) and no `status`.
                const status =
                    data.status ?? (data.done === true ? "done" : "todo")

                return {
                    id: taskDoc.id,
                    ...data,
                    status,
                    taskType: data.taskType ?? "其他",
                    details: data.details ?? "",
                    assignee: data.assignee ?? currentUser?.name ?? BASE_MEMBER_OPTIONS[0],
                    importance: data.importance ?? 3,
                }
                })

                // Sort client-side to avoid Firestore `orderBy` constraints
                // when some documents have inconsistent `createdAt` values/types.
                taskList.sort((a, b) => {
                    const at = a?.createdAt?.toDate
                        ? a.createdAt.toDate().getTime()
                        : 0
                    const bt = b?.createdAt?.toDate
                        ? b.createdAt.toDate().getTime()
                        : 0
                    return bt - at
                })

                setTasks(taskList)
                setTasksError(null)
            },
            (err) => {
                console.error("Firestore tasks subscribe failed:", err)
                setTasksError(err?.message ?? String(err))
            }
        )

        return () => unsubscribe()
    }, [demo, db, currentUser?.groupId, currentUser?.name, membershipReady])

    useEffect(() => {
        if (demo) return
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthUser(user)
            setProfileReady(!user)
            setAuthReady(true)
        })

        return () => unsubscribe()
    }, [demo, auth])

    useEffect(() => {
        if (demo) return
        if (!authUser) {
            setUserProfile(null)
            setMembershipReady(false)
            return
        }

        const userRef = doc(db, "users", authUser.uid)

        const unsubscribeUser = onSnapshot(
            userRef,
            (snapshot) => {
                setProfileReady(true)
                const data = snapshot.data() ?? {}
                setUserProfile({
                    uid: authUser.uid,
                    name: data.name ?? authUser.displayName ?? "",
                    role: data.role ?? "member",
                    groupId: data.groupId ?? "",
                    groupName: data.groupName ?? "",
                    teacherStatus: data.teacherStatus ?? "",
                    lastNameChangedAt: data.lastNameChangedAt ?? null,
                })
            },
            (error) => {
                setActionError("無法讀取帳號資料，請重新整理或稍後再試。" + (error?.code ? "（" + error.code + "）" : ""))
                setProfileReady(false)
                setUserProfile({
                    uid: authUser.uid,
                    name: authUser.displayName ?? "",
                    role: "member",
                    groupId: "",
                    groupName: "",
                    teacherStatus: "",
                    lastNameChangedAt: null,
                })
            }
        )

        return () => unsubscribeUser()
    }, [demo, authUser, db])

    useEffect(() => {
        if (demo) return
        if (!userProfile?.groupId) {
            setCurrentGroup(null)
            return
        }

        const groupRef = doc(db, "groups", userProfile.groupId)

        const unsubscribeGroup = onSnapshot(groupRef, (snapshot) => {
            setCurrentGroup(
                snapshot.exists()
                    ? {
                          id: snapshot.id,
                          ...snapshot.data(),
                      }
                    : null
            )
        })

        return () => unsubscribeGroup()
    }, [demo, userProfile?.groupId, db])

    useEffect(() => {
        if (demo) return
        if (!userProfile?.groupId || !membershipReady) {
            setTeamUsers([])
            return
        }

        const usersRef = collection(db, "groups", userProfile.groupId, "members")

        const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
            setTeamUsers(
                snapshot.docs
                    .map((userDoc) => ({
                        uid: userDoc.id,
                        ...userDoc.data(),
                    }))
                    .filter((user) => user.name)
            )
        })

        return () => unsubscribeUsers()
    }, [demo, userProfile?.groupId, db, membershipReady])

    useEffect(() => {
        if (demo) return
        if (!authUser) {
            setCurrentUser(null)
            return
        }

        setCurrentUser({
            uid: userProfile?.uid ?? authUser.uid,
            name: userProfile?.name ?? authUser.displayName ?? "",
            role:
                currentGroup?.leaderUid === authUser.uid
                    ? "leader"
                    : userProfile?.role ?? "member",
            groupId: userProfile?.groupId ?? "",
            groupName: currentGroup?.name ?? "",
            isLeader: currentGroup?.leaderUid === authUser.uid,
            isTeacher: userProfile?.role === "teacher",
            teacherStatus: userProfile?.teacherStatus ?? "",
            lastNameChangedAt: userProfile?.lastNameChangedAt ?? null,
        })
    }, [demo, authUser, userProfile, currentGroup])

    useEffect(() => {
        if (demo) return
        if (!currentUser?.name || isEditingName) return
        setNameDraft(currentUser.name)
        setNameError("")
    }, [demo, currentUser?.name, isEditingName])

    useEffect(() => {
        if (demo) return
        if (!authUser || !userProfile?.groupId || !userProfile.name) {
            setMembershipReady(false)
            return
        }

        setMembershipReady(false)

        setDoc(
            doc(db, "groups", userProfile.groupId, "members", authUser.uid),
            {
                name: userProfile.name,
                role:
                    currentGroup?.leaderUid === authUser.uid
                        ? "leader"
                        : "member",
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        )
            .then(() => {
                setMembershipReady(true)
            })
            .catch((err) => {
                setMembershipReady(false)
                console.error("Group member sync failed:", err)
        })
    }, [demo, authUser, db, userProfile?.groupId, userProfile?.name, currentGroup?.leaderUid])

    useEffect(() => {
        if (demo) return
        if (typeof window === "undefined") return
        try { window.localStorage.setItem("ganttOrder", JSON.stringify(ganttOrder)) } catch { /* Preferences are optional in private browsing. */ }
    }, [demo, ganttOrder])

    useEffect(() => {
        if (demo) return
        if (typeof window === "undefined") return
        try { window.localStorage.setItem("ganttColors", JSON.stringify(ganttColors)) } catch { /* Preferences are optional in private browsing. */ }
    }, [demo, ganttColors])

    useEffect(() => {
        if (demo) return
        if (!currentUser) return
        if (!currentUser.isLeader) {
            setAssigneeInput(currentUser.name)
            setEditAssignee(currentUser.name)
        } else {
            setAssigneeInput((current) => current || currentUser.name)
        }
    }, [demo, currentUser])

    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        const timer = window.setInterval(() => setClockNow(new Date()), 60000)
        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        const closeNavigation = event => { if (event.key === "Escape") setSidebarOpen(false) }
        window.addEventListener("keydown", closeNavigation)
        return () => window.removeEventListener("keydown", closeNavigation)
    }, [])

    useEffect(() => { if (showComposer) titleRef.current?.focus() }, [showComposer])

    const runAction = async (action, message = "已儲存變更") => {
        if (actionLock.current) return
        actionLock.current = true
        setBusy(true)
        setActionError("")
        setActionMessage("")
        try {
            const result = await action()
            if (result !== false) setActionMessage(message)
        } catch (error) {
            console.error("Workspace action failed", error)
            if (editTaskId !== null) setEditError(error?.message || "儲存失敗，請重試。")
            setActionError(error?.code === "permission-denied" ? "目前沒有操作權限，請確認組別與登入身份。" : error?.message || "儲存失敗，請確認連線後再試一次。")
        } finally {
            actionLock.current = false
            setBusy(false)
        }
    }
    const saveTask = async (id, payload) => {
        if (demo) {
            const values = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value?._methodName === "serverTimestamp" ? Timestamp.now() : value]))
            setTasks(current => current.map(task => task.id === id ? {...task, ...values} : task))
            return
        }
        await updateDoc(doc(db, "groups", currentUser.groupId, "tasks", id), payload)
    }
    const navigate = (page) => {
        setSidebarOpen(false)
        setActivePage(page === "overdue" ? "tasks" : page)
        if (page === "overdue") setTaskFilters({assignee:"all",taskType:"all",status:"all",deadlineTone:"overdue"})
        if (page === "overdue") setSearchQuery("")
        window.scrollTo({top:0, behavior:"instant"})
    }
    const exportTasks = () => {
        const url = URL.createObjectURL(new Blob([tasksToCsv(filteredTasks)], {type:"text/csv;charset=utf-8"}))
        const link = document.createElement("a")
        link.href = url
        link.download = "CampusFlow-tasks-" + new Date().toISOString().slice(0,10) + ".csv"
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    const memberOptions = Array.from(
        new Set([
            ...(currentUser?.name ? [currentUser.name] : []),
            ...teamUsers.map((user) => user.name).filter(Boolean),
            ...tasks
                .map((task) => task.assignee)
                .filter((assignee) => assignee && assignee !== ALL_ASSIGNEE),
        ])
    )
    const assigneeOptions = [ALL_ASSIGNEE, ...memberOptions]
    const filterAssigneeOptions = memberOptions
    const assignableOptions =
        currentUser?.isTeacher
            ? []
            : currentUser?.isLeader
            ? assigneeOptions
            : currentUser?.name
              ? [currentUser.name]
              : []
    const canCreateTasks = currentUser?.groupId && membershipReady && !currentUser.isTeacher
    const canDeleteTasks = currentUser?.isLeader
    const isTaskOwner = (task) =>
        task?.assignee === currentUser?.name ||
        task?.createdBy === authUser?.uid
    const canEditTask = (task) =>
        !currentUser?.isTeacher && (currentUser?.isLeader || isTaskOwner(task))
    const canActOnTask = () => currentUser?.isLeader
    const matchesAssigneeFilter = (task, assignee) =>
        assignee === "all" ||
        task.assignee === assignee ||
        task.assignee === ALL_ASSIGNEE

    const startOfThisWeek = (() => {
        const now = clockNow
        // Monday as start of week.
        const day = now.getDay() // 0 (Sun) - 6 (Sat)
        const diff = day === 0 ? -6 : 1 - day
        const d = new Date(now)
        d.setDate(now.getDate() + diff)
        d.setHours(0, 0, 0, 0)
        return d
    })()

    const endOfThisWeek = new Date(
        startOfThisWeek.getTime() + 7 * 24 * 60 * 60 * 1000
    )

    const isInThisWeek = (d) => d && d >= startOfThisWeek && d < endOfThisWeek

    const getTaskWeekDate = (task) =>
        tsToDate(task.deadlineAt) ??
        tsToDate(task.startedAt) ??
        tsToDate(task.createdAt)

    const tasksThisWeek = tasks.filter((t) => isInThisWeek(getTaskWeekDate(t)))
    const doneThisWeek = tasksThisWeek.filter((t) => t.status === "done").length
    const totalThisWeek = tasksThisWeek.length
    const weeklyMvp = memberOptions.map((member) => ({
        member,
        completed: tasksThisWeek.filter(
            (task) =>
                (task.assignee === member || task.assignee === ALL_ASSIGNEE) &&
                task.status === "done"
        ).length,
    })).sort((a, b) => b.completed - a.completed)[0]

    const now = new Date()

    const isOverdue = (task) => {
        const d = task?.deadlineAt?.toDate ? task.deadlineAt.toDate() : null
        return task.status !== "done" && d && d.getTime() < now.getTime()
    }

    const ganttItems = scheduledRows(tasks.filter(task => task.taskType === "畢業專題"))
        .sort((a, b) => {
            const ai = ganttOrder.indexOf(a.task.id)
            const bi = ganttOrder.indexOf(b.task.id)
            if (ai !== -1 || bi !== -1) {
                if (ai === -1) return 1
                if (bi === -1) return -1
                return ai - bi
            }
            return a.startDate - b.startDate
        })

    const getGanttColor = (task) => {
        if (ganttColors[task.id]) return ganttColors[task.id]
        if (task.status === "done") return "bg-emerald-700"
        if (isOverdue(task)) return "bg-rose-700"
        if (getDeadlineTone(task) === "soon") return "bg-amber-600"
        if (task.status === "doing") return "bg-indigo-700"
        return "bg-slate-700"
    }

    const getTaskCardClass = (task) => {
        const tone = getDeadlineTone(task)
        const base = "transition duration-150 ease-out hover:scale-[1.01] hover:shadow-md"
        if (tone === "overdue") return `${base} bg-red-50 border-red-500 hover:bg-red-100`
        if (tone === "soon") return `${base} bg-yellow-50 border-yellow-500 hover:bg-yellow-100`
        return `${base} bg-white border-gray-200 hover:bg-gray-50`
    }

    const getImportance = (task) =>
        Math.min(5, Math.max(1, Number(task.importance ?? 3)))

    const renderImportanceStars = (importance) => (
        <span className="text-xs text-yellow-500 tracking-normal">
            {"★".repeat(importance)}
            <span className="text-gray-300">{"★".repeat(5 - importance)}</span>
        </span>
    )

    const getLateDays = (task) => {
        const deadline = tsToDate(task.deadlineAt)
        if (!deadline) return 0
        const comparison =
            task.status === "done"
                ? tsToDate(task.finishedAt)
                : now
        if (!comparison || comparison <= deadline) return 0
        return Math.max(1, Math.ceil((comparison.getTime() - deadline.getTime()) / DAY_MS))
    }

    const getTaskReward = (task) => getImportance(task) * 10

    const getLatePenalty = (task) => {
        const lateDays = getLateDays(task)
        if (!lateDays) return 0
        return Math.ceil(getImportance(task) * 5 * Math.pow(1.25, lateDays - 1))
    }

    const getTaskPoints = (task) => {
        const reward = task.status === "done" ? getTaskReward(task) : 0
        return reward - getLatePenalty(task)
    }

    const overdueOpenTasks = tasks
        .filter((task) => task.status !== "done" && isOverdue(task))
        .sort((a, b) => getLatePenalty(b) - getLatePenalty(a))

    const leaderboard = memberOptions.map((member) => {
        const memberTasks = tasks.filter(
            (task) => task.assignee === member || task.assignee === ALL_ASSIGNEE
        )
        const completedTasks = memberTasks.filter((task) => task.status === "done")
        const overdueTasks = memberTasks.filter((task) => getLateDays(task) > 0)
        const points = memberTasks.reduce(
            (total, task) => total + getTaskPoints(task),
            0
        )

        return {
            member,
            completedCount: completedTasks.length,
            overdueCount: overdueTasks.length,
            points,
        }
    }).sort((a, b) => b.points - a.points)
    const leaderboardHasScores = leaderboard.some((entry) => entry.points !== 0)
    const leaderboardWithRanks = leaderboard.map((entry, index, list) => {
        const previous = list[index - 1]
        const rank =
            previous && previous.points === entry.points
                ? previous.rank
                : index + 1
        return { ...entry, rank }
    })

    const getAssigneeBadgeClass = (assignee) => {
        if (assignee === ALL_ASSIGNEE) return "bg-stone-200 text-stone-800 border-stone-400"
        if (assignee === "Chou") return "bg-blue-100 text-blue-700 border-blue-300"
        if (assignee === "Lin") return "bg-emerald-100 text-emerald-700 border-emerald-300"
        if (assignee === "Lee") return "bg-amber-100 text-amber-700 border-amber-300"
        return "bg-gray-100 text-gray-700 border-gray-300"
    }

    const renderAssigneeBadge = (task) => (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getAssigneeBadgeClass(
                task.assignee
            )}`}
        >
            {task.assignee ?? "未指定"}
        </span>
    )

    const toggleTaskDetails = (taskId) => {
        setExpandedTaskIds((current) => ({
            ...current,
            [taskId]: !current[taskId],
        }))
    }

    const moveGanttItem = (taskId, direction) => {
        const currentIds = ganttItems.map((item) => item.task.id)
        const orderedIds = [
            ...ganttOrder.filter((id) => currentIds.includes(id)),
            ...currentIds.filter((id) => !ganttOrder.includes(id)),
        ]
        const index = orderedIds.indexOf(taskId)
        const nextIndex = index + direction
        if (index < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) return

        const nextOrder = [...orderedIds]
        const temp = nextOrder[index]
        nextOrder[index] = nextOrder[nextIndex]
        nextOrder[nextIndex] = temp
        setGanttOrder(nextOrder)
    }

    const renderTaskMeta = (
        task,
        {
            showFinished = false,
            collapsibleDetails = false,
            showAssignee = true,
        } = {}
    ) => (
        <>
            {task.details ? (
                collapsibleDetails ? (
                    <div className="mt-1">



                        <button
                            className="text-xs text-blue-600"
                            onClick={() => toggleTaskDetails(task.id)}
                        >
                            {expandedTaskIds[task.id] ? "收合詳細內容" : "查看詳細內容"}
                        </button>
                        {expandedTaskIds[task.id] ? (
                            <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                                {task.details}
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                        {task.details}
                    </p>
                )
            ) : null}
            {showAssignee ? (
                <div className="mt-2">{renderAssigneeBadge(task)}</div>
            ) : null}
            <div className="mt-1">
                {renderImportanceStars(getImportance(task))}
                <span className="ml-2 text-xs text-gray-500">
                    積分：{getTaskPoints(task)}
                </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
                截止：{formatTs(task.deadlineAt)}
                {getDeadlineTone(task) === "overdue"
                    ? "（已超期）"
                    : getDeadlineTone(task) === "soon"
                      ? "（將近）"
                      : ""}
            </p>
            <p className="text-xs text-gray-500 mt-1">
                開始：{formatTs(task.startedAt)}
            </p>
            {showFinished ? (
                <p className="text-xs text-gray-500 mt-1">
                    完成：{formatTs(task.finishedAt)}
                </p>
            ) : null}
        </>
    )

    const handleAddTask = async () => {
        const text = input.trim()
        if (!canCreateTasks) return
        if (!text) { titleRef.current?.focus(); throw new Error("請填寫任務標題。") }
        const scheduleError = validateSchedule(startInput, deadlineInput)
        if (scheduleError) throw new Error(scheduleError)

        const details = detailsInput.trim()
        const deadlineAt = deadlineInput
            ? Timestamp.fromDate(new Date(deadlineInput))
            : null
        const startedAt =
            startInput
                ? Timestamp.fromDate(new Date(startInput))
                : null

        const finalAssignee =
            currentUser?.isLeader
                ? assigneeInput
                : currentUser?.name
        if (!finalAssignee) return

        const newTask = {
            text,
            details,
            assignee: finalAssignee,
            importance: Number(importanceInput),
            groupId: currentUser?.groupId ?? "",
            createdBy: authUser?.uid ?? null,
            createdByName: currentUser?.name ?? null,
            done: false, // keep for backward compatibility
            status: "todo",
            taskType: taskScheduleType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedBy: authUser?.uid ?? null,
            deadlineAt,
            startedAt,
            finishedAt: null,
        }

        if (demo) setTasks(current => [{...newTask,id:crypto.randomUUID(),createdAt:Timestamp.now(),updatedAt:Timestamp.now()}, ...current])
        else await addDoc(collection(db, "groups", currentUser.groupId, "tasks"), newTask)
        setShowComposer(false)
        setInput("")
        setDetailsInput("")
        setAssigneeInput(
            currentUser?.isLeader
                ? currentUser.name
                : currentUser?.name ?? BASE_MEMBER_OPTIONS[0]
        )
        setImportanceInput(3)
        setStartInput("")
        setDeadlineInput("")
    }

    const handleLogin = async () => {
        const name = loginName.trim()
        const projectName = projectNameInput.trim()
        const groupCode = groupCodeInput.trim()
        if (!name) {
            setLoginError("請輸入匿名")
            return
        }
        if (loginRole === "leader" && !projectName) {
            setLoginError("請輸入畢業專題名稱")
            return
        }
        if (loginRole === "member" && !groupCode) {
            setLoginError("請輸入組長提供的空間代碼")
            return
        }

        try {
            const provider = new GoogleAuthProvider()
            let credential
            try {
                credential = await signInWithPopup(auth, provider)
            } catch (err) {
                if (err?.code === "auth/popup-blocked") {
                    await signInWithRedirect(auth, provider)
                    return
                }
                throw err
            }
            let groupId = groupCode
            let groupName = ""

            if (loginRole === "teacher") {
                await setDoc(
                    doc(db, "users", credential.user.uid),
                    {
                        name,
                        role: "teacher",
                        teacherStatus: "pending",
                        groupId: "",
                        groupName: "",
                        displayName: name,
                        email: credential.user.email ?? "",
                        photoURL: credential.user.photoURL ?? "",
                        provider: "google",
                        updatedAt: serverTimestamp(),
                        createdAt: serverTimestamp(),
                    },
                    { merge: true }
                )
                await addDoc(collection(db, "issueReports"), {
                    groupId: "__teacher_review__",
                    groupName: "指導老師審核",
                    reporterUid: credential.user.uid,
                    reporterName: name,
                    reporterRole: "teacher",
                    page: "teacher-signup",
                    message: `指導老師帳號申請：${name}，Email：${credential.user.email ?? "未提供"}，UID：${credential.user.uid}`,
                    discordForwarded: false,
                    createdAt: serverTimestamp(),
                })
                setUserProfile({
                    uid: credential.user.uid,
                    name,
                    role: "teacher",
                    groupId: "",
                    groupName: "",
                    teacherStatus: "pending",
                })
                setCurrentUser({
                    uid: credential.user.uid,
                    name,
                    role: "teacher",
                    groupId: "",
                    groupName: "",
                    isLeader: false,
                    isTeacher: true,
                    teacherStatus: "pending",
                })
                setLoginError("")
                return
            }

            if (loginRole === "leader") {
                const groupRef = await addDoc(collection(db, "groups"), {
                    name: projectName,
                    leaderUid: credential.user.uid,
                    leaderName: name,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                })
                groupId = groupRef.id
                groupName = projectName
            } else {
                const groupSnapshot = await getDoc(doc(db, "groups", groupId))
                if (!groupSnapshot.exists()) {
                    setLoginError("找不到這個空間代碼，請確認是否輸入正確")
                    await signOut(auth)
                    return
                }
                groupName = groupSnapshot.data().name ?? ""
            }
            await setDoc(
                doc(db, "users", credential.user.uid),
                {
                    name,
                    role: loginRole === "leader" ? "leader" : "member",
                    groupId,
                    groupName,
                    displayName: name,
                    email: credential.user.email ?? "",
                    photoURL: credential.user.photoURL ?? "",
                    provider: "google",
                    updatedAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                },
                { merge: true }
            )
            await setDoc(
                doc(db, "groups", groupId, "members", credential.user.uid),
                {
                    name,
                    role: loginRole === "leader" ? "leader" : "member",
                    email: credential.user.email ?? "",
                    photoURL: credential.user.photoURL ?? "",
                    updatedAt: serverTimestamp(),
                    joinedAt: serverTimestamp(),
                },
                { merge: true }
            )
            setUserProfile({
                uid: credential.user.uid,
                name,
                role: loginRole === "leader" ? "leader" : "member",
                groupId,
            })
            setCurrentUser({
                uid: credential.user.uid,
                name,
                role: loginRole === "leader" ? "leader" : "member",
                groupId,
                groupName,
                isLeader: loginRole === "leader",
            })
            setAssigneeInput(name)
            setEditAssignee(name)
            setLoginError("")
        } catch (err) {
            setLoginError(err?.message ?? String(err))
        }
    }

    const signInGoogle = async () => {
        const provider = new GoogleAuthProvider()
        try {
            await signInWithPopup(auth, provider)
            setLoginError("")
        } catch (err) {
            if (err?.code === "auth/popup-blocked") {
                await signInWithRedirect(auth, provider)
                return
            }
            setLoginError(err?.message ?? String(err))
        }
    }

    const handleLogout = () => {
        if (demo) { window.location.href = window.location.pathname; return }
        signOut(auth)
    }

    const copyGroupCode = async () => {
        if (!currentUser?.groupId) return
        try {
            await navigator.clipboard.writeText(currentUser.groupId)
            setCopiedGroupCode(true)
            window.setTimeout(() => setCopiedGroupCode(false), 1600)
        } catch {
            setCopiedGroupCode(false)
        }
    }

    const copyLoginUrl = async () => {
        if (typeof window === "undefined") return
        try {
            await navigator.clipboard.writeText(window.location.href)
            setCopiedLoginUrl(true)
            window.setTimeout(() => setCopiedLoginUrl(false), 1600)
        } catch {
            setCopiedLoginUrl(false)
        }
    }

    const nameChangeAvailableAt = (() => {
        const lastChanged = tsToDate(currentUser?.lastNameChangedAt)
        return lastChanged
            ? new Date(lastChanged.getTime() + DAY_MS)
            : null
    })()
    const canChangeName =
        !nameChangeAvailableAt || nameChangeAvailableAt.getTime() <= clockNow.getTime()

    const handleStartEditName = () => {
        setNameDraft(currentUser?.name ?? "")
        setNameError("")
        setIsEditingName(true)
    }

    const handleCancelEditName = () => {
        setNameDraft(currentUser?.name ?? "")
        setNameError("")
        setIsEditingName(false)
    }

    const handleSaveName = async () => {
        if (demo) { setActionMessage("示範模式：此操作不會傳送至正式系統。"); return }
        const nextName = nameDraft.trim()
        if (!authUser || !currentUser?.groupId) return
        if (!nextName) {
            setNameError("名稱不能空白")
            return
        }
        if (nextName === currentUser.name) {
            setIsEditingName(false)
            setNameError("")
            return
        }
        if (!canChangeName) {
            setNameError(
                `每 24 小時只能修改一次，下一次可修改時間：${nameChangeAvailableAt.toLocaleString()}`
            )
            return
        }

        try {
            const updatePayload = {
                name: nextName,
                displayName: nextName,
                updatedAt: serverTimestamp(),
                lastNameChangedAt: serverTimestamp(),
            }
            await updateDoc(doc(db, "users", authUser.uid), updatePayload)
            await setDoc(
                doc(db, "groups", currentUser.groupId, "members", authUser.uid),
                {
                    name: nextName,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            )
            setAssigneeInput((current) =>
                current === currentUser.name ? nextName : current
            )
            setEditAssignee((current) =>
                current === currentUser.name ? nextName : current
            )
            setIsEditingName(false)
            setNameError("")
        } catch (err) {
            setNameError(err?.message ?? String(err))
        }
    }

    const handleSubmitIssueReport = async () => {
        if (demo) { setActionMessage("示範模式：此操作不會傳送至正式系統。"); return }
        const message = issueReportText.trim()
        if (!authUser || !currentUser?.groupId) return
        if (message.length < 3) {
            setIssueReportStatus("請至少輸入 3 個字。")
            return
        }

        try {
            await addDoc(collection(db, "issueReports"), {
                groupId: currentUser.groupId,
                groupName: currentUser.groupName ?? "",
                reporterUid: authUser.uid,
                reporterName: currentUser.name ?? "",
                reporterRole: currentUser.isLeader ? "leader" : "member",
                page: activePage,
                message,
                discordForwarded: false,
                createdAt: serverTimestamp(),
            })
            setIssueReportText("")
            setIssueReportStatus("已送出，Discord bot 會轉發到回報頻道。")
            window.setTimeout(() => setIssueReportStatus(""), 2500)
        } catch (err) {
            setIssueReportStatus(err?.message ?? String(err))
        }
    }

    const handleTeacherJoinGroup = async () => {
        if (demo) { setActionMessage("示範模式：此操作不會傳送至正式系統。"); return }
        const groupCode = teacherGroupCodeInput.trim()
        if (!authUser || !userProfile || !groupCode) return
        setTeacherJoinError("")

        try {
            const groupSnapshot = await getDoc(doc(db, "groups", groupCode))
            if (!groupSnapshot.exists()) {
                setTeacherJoinError("找不到這個組別代碼，請確認是否複製完整。")
                return
            }

            const groupName = groupSnapshot.data().name ?? ""
            await updateDoc(doc(db, "users", authUser.uid), {
                groupId: groupCode,
                groupName,
                updatedAt: serverTimestamp(),
            })
            await setDoc(
                doc(db, "groups", groupCode, "members", authUser.uid),
                {
                    name: userProfile.name,
                    role: "teacher",
                    email: authUser.email ?? "",
                    photoURL: authUser.photoURL ?? "",
                    updatedAt: serverTimestamp(),
                    joinedAt: serverTimestamp(),
                },
                { merge: true }
            )
            setTeacherGroupCodeInput("")
        } catch (err) {
            setTeacherJoinError(err?.message ?? String(err))
        }
    }

    const isTeacherAccount = userProfile?.role === "teacher"
    const isTeacherPending =
        authReady &&
        authUser &&
        isTeacherAccount &&
        userProfile?.teacherStatus !== "approved"
    const isTeacherApprovedWithoutGroup =
        authReady &&
        authUser &&
        isTeacherAccount &&
        userProfile?.teacherStatus === "approved" &&
        !userProfile?.groupId
    const needsInitialSetup =
        profileReady && authReady && authUser && !userProfile?.groupId && !isTeacherAccount
    const shouldShowLogin = !demo && authReady && (!authUser || (profileReady && needsInitialSetup))

    const formatTs = (ts) => {
        if (!ts?.toDate) return "—"
        return ts.toDate().toLocaleString()
    }

    function tsToDate(ts) {
        if (!ts?.toDate) return null
        return ts.toDate()
    }

    const dateToDatetimeLocalValue = (d) => {
        if (!d) return ""
        const pad = (n) => String(n).padStart(2, "0")
        const yyyy = d.getFullYear()
        const mm = pad(d.getMonth() + 1)
        const dd = pad(d.getDate())
        const hh = pad(d.getHours())
        const mi = pad(d.getMinutes())
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
    }

    const tsToDatetimeLocalValue = (ts) => {
        const d = tsToDate(ts)
        return d ? dateToDatetimeLocalValue(d) : ""
    }

    const dateKey = (d) => {
        if (!d) return null
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, "0")
        const dd = String(d.getDate()).padStart(2, "0")
        return `${yyyy}-${mm}-${dd}`
    }

    const DEADLINE_SOON_HOURS = 72

    const getDeadlineDate = (task) => {
        if (!task?.deadlineAt?.toDate) return null
        return task.deadlineAt.toDate()
    }

    const getDeadlineTone = (task) => {
        const d = getDeadlineDate(task)
        if (!d) return "normal"

        // 已完成的任務不做「提醒」色彩
        if (task.status === "done") return "normal"

        const now = new Date()
        if (d.getTime() < now.getTime()) return "overdue"

        const soonLimit = new Date(now.getTime() + DEADLINE_SOON_HOURS * 60 * 60 * 1000)
        return d.getTime() <= soonLimit.getTime() ? "soon" : "normal"
    }

    const handleDeleteTask = async (task) => {
        if (!canDeleteTasks) return
        if (!window.confirm('確定刪除「' + task.text + '」？此操作無法復原。')) return false
        if (demo) setTasks(current => current.filter(item => item.id !== task.id))
        else await deleteDoc(doc(db, "groups", currentUser.groupId, "tasks", task.id))
    }

    const handleStartTask = async (task) => {
        if (!canActOnTask(task)) return
        await saveTask(task.id, {
            status: "doing",
            done: false,
            startedAt: serverTimestamp(),
            finishedAt: null,
        })
    }

    const handleCompleteTask = async (task) => {
        if (!canActOnTask(task)) return
        await saveTask(task.id, {
            status: "done",
            done: true,
            finishedAt: serverTimestamp(),
        })
    }

    const editingTask =
        editTaskId !== null ? tasks.find((t) => t.id === editTaskId) : null

    const handleCancelEdit = () => {
        setEditTaskId(null)
        setEditText("")
        setEditDetails("")
        setEditAssignee(currentUser?.name ?? BASE_MEMBER_OPTIONS[0])
        setEditImportance(3)
        setEditTaskType("其他")
        setEditStartInput("")
        setEditDeadlineInput("")
        setEditFinishedInput("")
        setEditError(null)
    }

    const handleOpenEditTask = (task) => {
        if (!canEditTask(task)) return
        setEditTaskId(task.id)
        setEditText(task.text ?? "")
        setEditDetails(task.details ?? "")
        setEditAssignee(
            currentUser?.isLeader
                ? task.assignee ?? currentUser?.name ?? BASE_MEMBER_OPTIONS[0]
                : currentUser?.name ?? task.assignee ?? BASE_MEMBER_OPTIONS[0]
        )
        setEditImportance(getImportance(task))
        setEditTaskType(task.taskType ?? "其他")
        setEditDeadlineInput(tsToDatetimeLocalValue(task.deadlineAt))
        setEditStartInput(tsToDatetimeLocalValue(task.startedAt))
        setEditFinishedInput(tsToDatetimeLocalValue(task.finishedAt))
        setEditError(null)
    }

    const handleSaveEditTask = async (task) => {
        if (!canEditTask(task)) return false
        const scheduleError = validateSchedule(editStartInput, editDeadlineInput)
        if (scheduleError) { setEditError(scheduleError); return false }
        const nextText = editText.trim()
        if (!nextText) {
            setEditError("請填寫任務標題")
            return false
        }

        const deadlineAt = editDeadlineInput
            ? Timestamp.fromDate(new Date(editDeadlineInput))
            : null
        const startedAt = editStartInput
            ? Timestamp.fromDate(new Date(editStartInput))
            : null

        const payload = {
            text: nextText,
            details: editDetails.trim(),
            assignee:
                currentUser?.isLeader
                    ? editAssignee
                    : currentUser?.name ?? task.assignee,
            importance: Number(editImportance),
            taskType: editTaskType,
            updatedAt: serverTimestamp(),
            updatedBy: authUser?.uid ?? null,
            deadlineAt,
            startedAt,
        }

        if (task.status === "done") {
            payload.finishedAt = editFinishedInput
                ? Timestamp.fromDate(new Date(editFinishedInput))
                : null
        }

        await saveTask(task.id, payload)
        handleCancelEdit()
    }

    // ===== Calendar (行事曆) =====
    const effectiveSelectedDateKey =
        selectedDateKey ?? dateKey(new Date(calendarCursor))

    const calendarYear = calendarCursor.getFullYear()
    const calendarMonth = calendarCursor.getMonth()
    const monthStart = new Date(calendarYear, calendarMonth, 1)
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
    const firstWeekday = monthStart.getDay() // 0 (Sun) - 6 (Sat)

    const calendarCells = Array.from({ length: 42 }, (_, i) => {
        const dayNumber = i - firstWeekday + 1
        if (dayNumber < 1 || dayNumber > daysInMonth) {
            return { key: null, date: null }
        }
        const d = new Date(calendarYear, calendarMonth, dayNumber)
        return { key: dateKey(d), date: d }
    })

    const getTasksForDayKey = (key) => {
        if (!key) return []
        return tasks.filter((t) => {
            const started = tsToDate(t.startedAt)
            const deadline = tsToDate(t.deadlineAt)
            const startedKey = dateKey(started)
            const deadlineKey = dateKey(deadline)
            return startedKey === key || deadlineKey === key
        })
    }

    const updateTaskFilter = (key, value) => {
        setTaskFilters((current) => ({
            ...current,
            [key]: value,
        }))
    }

    const updateGanttFilter = (key, value) => {
        setGanttFilters((current) => ({
            ...current,
            [key]: value,
        }))
    }

    const updateGanttColor = (taskId, color) => {
        setGanttColors((current) => ({
            ...current,
            [taskId]: color,
        }))
    }

    const filteredTasks = sortTasks(tasks.filter((task) => {
        if (!matchesSearch(task, searchQuery)) return false
        if (!matchesAssigneeFilter(task, taskFilters.assignee)) {
            return false
        }
        if (taskFilters.taskType !== "all" && task.taskType !== taskFilters.taskType) {
            return false
        }
        if (
            taskFilters.deadlineTone !== "all" &&
            getDeadlineTone(task) !== taskFilters.deadlineTone
        ) {
            return false
        }
        if (taskFilters.status !== "all" && task.status !== taskFilters.status) {
            return false
        }
        return true
    }), sortOrder)

    const getFilteredCalendarTasksForDayKey = (key) =>
        filteredTasks.filter((task) => getTasksForDayKey(key).includes(task))

    if (!demo && (!authReady || (authUser && !profileReady))) return <div className="loading-screen" role="status"><span className="brand-mark">cf</span><p>{actionError || "正在開啟工作室…"}</p>{actionError ? <button className="secondary-button" onClick={()=>window.location.reload()}>重新載入</button> : null}</div>

    if (isTeacherPending) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200 p-6 font-sans">
                <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-stone-50 p-6 text-center shadow-xl">
                    <h1 className="text-2xl font-bold text-stone-900">
                        指導老師權限審核中
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-stone-600">
                        你的申請已送出，系統已透過問題回報通知管理者。審核通過後，再回到這裡輸入組別代碼即可查看指導組別。
                    </p>
                    <button
                        className="mt-5 rounded bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-950"
                        onClick={handleLogout}
                    >
                        登出
                    </button>
                </div>
            </div>
        )
    }

    if (isTeacherApprovedWithoutGroup) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200 p-6 font-sans">
                <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-stone-50 p-6 shadow-xl">
                    <h1 className="text-2xl font-bold text-stone-900">
                        輸入指導組別代碼
                    </h1>
                    <p className="mt-2 text-sm text-stone-600">
                        請向學生組長索取組別代碼。輸入後，這個老師帳號會加入該組的查看空間。
                    </p>
                    <input
                        className="mt-4 w-full rounded border border-stone-300 bg-white p-2"
                        aria-label="指導組別代碼" value={teacherGroupCodeInput}
                        onChange={(e) => setTeacherGroupCodeInput(e.target.value)}
                        placeholder="組別代碼"
                    />
                    {teacherJoinError ? (
                        <p className="mt-2 text-sm text-red-600">{teacherJoinError}</p>
                    ) : null}
                    <div className="mt-4 flex gap-2">
                        <button
                            className="flex-1 rounded bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={handleTeacherJoinGroup}
                            disabled={!teacherGroupCodeInput.trim()}
                        >
                            加入組別
                        </button>
                        <button
                            className="rounded border border-stone-300 px-4 py-2 text-stone-600 hover:bg-white"
                            onClick={handleLogout}
                        >
                            登出
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`workspace ${sidebarOpen ? "sidebar-open" : ""}`} >
            <a className="skip-link" href="#workspace-main">跳至主要內容</a>
            <header className="workspace-header" inert={shouldShowLogin}>
                <button className="mobile-menu" aria-label={sidebarOpen ? "關閉導覽" : "開啟導覽"} aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(!sidebarOpen)}><Icon name={sidebarOpen ? "close" : "menu"}/></button>
                <span className="header-project">{currentUser?.groupName || "CampusFlow"}</span>
                <span className="header-date">{now.toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"short"})}</span>
                <span className="header-user">{currentUser?.isTeacher ? "指導老師" : currentUser?.isLeader ? "組長" : "組員"}<span className="avatar">{Array.from(currentUser?.name || "C")[0]}</span></span>
            </header>
            {shouldShowLogin ? (
                <div className="login-screen">
                    <section className="login-story"><a className="brand" href="./"><span className="brand-mark">c<span>f</span></span>CampusFlow</a><div><h1>畢業專題<br/>管理工作室</h1><p>管理小組任務、成員分工與專題進度。<br/>支援行事曆、甘特圖與指導老師檢視。</p><div className="login-features"><span><Icon name="tasks"/>任務分工</span><span><Icon name="gantt"/>進度追蹤</span><span><Icon name="people"/>師生協作</span></div></div><p className="login-foot">學生小組與指導老師共用</p></section>
                    <div className="login-form">
                        <h2 className="text-2xl font-bold text-stone-900">
                            進入 CampusFlow
                        </h2>
                        <p className="mt-1 text-sm text-stone-600">
                            使用 Google 帳號登入，再建立或加入你的專題小組。
                        </p>
                        {isEmbeddedBrowser ? (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <p className="font-semibold">Google 登入無法在 App 內建瀏覽器使用</p>
                                <p className="mt-1">
                                    請用 Chrome、Safari 或手機系統瀏覽器開啟這個頁面後再登入。
                                </p>
                                <button
                                    className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700"
                                    onClick={copyLoginUrl}
                                >
                                    {copiedLoginUrl ? "已複製連結" : "複製頁面連結"}
                                </button>
                            </div>
                        ) : null}
                        {!authUser ? (
                            <button
                                className="mt-5 w-full rounded bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800"
                                onClick={signInGoogle}
                            >
                                使用 Google 登入
                            </button>
                        ) : null}
                        {!authUser && <><p className="login-explainer">第一次使用？登入後，組長可以建立專題，組員使用空間代碼加入，老師則可申請指導權限。</p><a className="demo-link" href="?demo=1">先看看示範工作室 <Icon name="arrow" size={16}/></a></>}
                        {loginError && !needsInitialSetup ? <p role="alert" className="text-sm text-red-600 mt-3">{loginError}</p> : null}
                        {needsInitialSetup ? (
                        <div className="mt-5 space-y-3">
                            <div>
                                <label className="text-sm text-stone-600">
                                    顯示名稱
                                </label>
                                <input
                                    className="mt-1 w-full rounded border border-stone-300 bg-stone-100 p-2 text-sm text-stone-600"
                                    aria-label="顯示名稱" value={loginName}
                                    onChange={(e) => setLoginName(e.target.value)}
                                    placeholder="例如 Chou"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-stone-600">
                                    身份
                                </label>
                                <select
                                    className="mt-1 w-full rounded border border-stone-300 bg-white p-2"
                                    aria-label="身份" value={loginRole}
                                    onChange={(e) => setLoginRole(e.target.value)}
                                >
                                    <option value="member">組員</option>
                                    <option value="leader">組長</option>
                                    <option value="teacher">指導老師</option>
                                </select>
                            </div>
                            {loginRole === "leader" ? (
                                <div>
                                    <label className="text-sm text-stone-600">
                                        畢業專題名稱
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded border border-stone-300 bg-white p-2"
                                        aria-label="畢業專題名稱" value={projectNameInput}
                                        onChange={(e) =>
                                            setProjectNameInput(e.target.value)
                                        }
                                        placeholder="例如：智慧校園排程系統"
                                    />
                                </div>
                            ) : loginRole === "member" ? (
                                <div>
                                    <label className="text-sm text-stone-600">
                                        空間代碼
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded border border-stone-300 bg-white p-2"
                                        aria-label="空間代碼" value={groupCodeInput}
                                        onChange={(e) =>
                                            setGroupCodeInput(e.target.value)
                                        }
                                        placeholder="請輸入組長提供的代碼"
                                    />
                                </div>
                            ) : (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-stone-700">
                                    指導老師帳號建立後會先等待審核，通過前不會看到任何組別資料。
                                </div>
                            )}
                            {loginError ? (
                                <p className="text-sm text-red-600">{loginError}</p>
                            ) : null}
                            <button
                                className="w-full rounded bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800"
                                onClick={handleLogin}
                            >
                                登入
                            </button>
                        </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {/* 側邊欄 */}
            <aside className="workspace-sidebar" aria-label="工作室導覽" inert={shouldShowLogin}>
                <a className="brand" href={demo ? "?demo=1" : "./"}><span className="brand-mark">c<span>f</span></span>CampusFlow</a>
                <p className="sidebar-heading">專題工作室</p>
                {currentUser ? (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        {isEditingName ? (
                            <div className="space-y-2">
                                <input
                                    className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-sm text-stone-800"
                                    aria-label="新的顯示名稱" value={nameDraft}
                                    onChange={(e) => setNameDraft(e.target.value)}
                                    maxLength={24}
                                />
                                <div className="flex gap-2">
                                    <button
                                        className="rounded bg-amber-700 px-2 py-1 text-xs font-medium text-white hover:bg-amber-800"
                                        onClick={handleSaveName}
                                    >
                                        儲存
                                    </button>
                                    <button
                                        className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-white"
                                        onClick={handleCancelEditName}
                                    >
                                        取消
                                    </button>
                                </div>
                                {nameError ? (
                                    <p className="text-xs text-red-600">{nameError}</p>
                                ) : null}
                            </div>
                        ) : (
                            <>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-stone-800">
                                            {currentUser.name}
                                        </p>
                                        <p className="text-xs text-stone-600">
                                            {currentUser.isTeacher ? "指導老師" : currentUser.isLeader ? "組長" : "組員"}
                                        </p>
                                    </div>
                                    <button
                                        className="shrink-0 rounded border border-amber-300 bg-white/70 px-2 py-1 text-xs text-stone-600 hover:bg-white hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={handleStartEditName}
                                        disabled={!canChangeName}
                                        title={
                                            canChangeName
                                                ? "修改名稱"
                                                : `下一次可修改時間：${nameChangeAvailableAt?.toLocaleString()}`
                                        }
                                    >
                                        改名
                                    </button>
                                </div>
                                {!canChangeName ? (
                                    <p className="mt-1 text-[11px] text-stone-500">
                                        下次可改：{nameChangeAvailableAt?.toLocaleString()}
                                    </p>
                                ) : null}
                                {nameError ? (
                                    <p className="mt-1 text-xs text-red-600">{nameError}</p>
                                ) : null}
                            </>
                        )}
                        <div className="hidden">
                        <p className="text-sm font-bold text-stone-800">
                            {currentUser.name}
                        </p>
                        <p className="text-xs text-stone-600">
                            {currentUser.isLeader ? "組長" : "組員"}
                        </p>

                        </div>
                        {currentUser.isLeader && currentUser.groupId ? (
                            <div className="mt-2 rounded border border-amber-200 bg-white/70 p-2 text-xs text-stone-600">
                                <div className="flex items-center gap-2">
                                    <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-stone-100 px-2 py-1 text-[11px] text-stone-800">
                                        {currentUser.groupId}
                                    </code>
                                    <button
                                        className="shrink-0 rounded border border-amber-300 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-amber-50"
                                        onClick={copyGroupCode}
                                    >
                                        {copiedGroupCode ? "已複製" : "複製"}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                        {currentUser.isTeacher ? (
                            <div className="mt-2 rounded border border-amber-200 bg-white/70 p-2 text-xs text-stone-600">
                                <div className="font-semibold text-stone-800">
                                    切換指導組別
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                                        aria-label="指導組別代碼" value={teacherGroupCodeInput}
                                        onChange={(e) => setTeacherGroupCodeInput(e.target.value)}
                                        placeholder="組別代碼"
                                    />
                                    <button
                                        className="shrink-0 rounded border border-amber-300 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={handleTeacherJoinGroup}
                                        disabled={!teacherGroupCodeInput.trim()}
                                    >
                                        查看
                                    </button>
                                </div>
                                {teacherJoinError ? (
                                    <p className="mt-1 text-[11px] text-red-600">
                                        {teacherJoinError}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                        <button
                            className="mt-2 text-xs text-stone-500 hover:text-stone-900"
                            onClick={handleLogout}
                        >
                            登出
                        </button>
                    </div>
                ) : null}

                <nav className="workspace-nav">
                    {[["dashboard","home","工作室總覽"],["tasks","tasks","所有任務"],["calendar","calendar","行事曆"],["gantt","gantt","專題甘特圖"],["drive","folder","雲端檔案目錄"],["files","files","檔案協作規範"],["leaderboard","award","團隊排行榜"]].map(([page,icon,label]) => <button key={page} aria-current={activePage===page?"page":undefined} onClick={()=>navigate(page)}><Icon name={icon}/><span>{label}</span>{page==="tasks"?<small>{tasks.length}</small>:null}</button>)}
                </nav>

                <div className="sidebar-secondary">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                        <h3 className="font-bold text-sm text-red-700 mb-2">
                            逾期提醒與扣分
                        </h3>
                        {overdueOpenTasks.length === 0 ? (
                            <p className="text-xs text-red-700/70">
                                目前沒有超時未完成任務
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {overdueOpenTasks.slice(0, 4).map((task) => (
                                    <div key={task.id} className="text-xs text-red-800">
                                        <div className="font-medium truncate">
                                            {task.text}
                                        </div>
                                        <div>
                                            {task.assignee} · 扣 {getLatePenalty(task)} 分
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border bg-white p-3">
                        <h3 className="font-bold text-sm mb-2">最近更新</h3>
                        {tasks.slice(0, 3).length === 0 ? (
                            <p className="text-xs text-gray-500">目前沒有任務</p>
                        ) : (
                            <div className="space-y-2">
                                {tasks.slice(0, 3).map((task) => (
                                    <div key={task.id} className="text-xs text-gray-600">
                                        <div className="font-medium truncate">
                                            {task.text}
                                        </div>
                                        <div>
                                            {task.status === "done"
                                                ? `完成(${formatTs(task.finishedAt)})`
                                                : task.status === "doing"
                                                  ? `開始(${formatTs(task.startedAt)})`
                                                  : `新增(${formatTs(task.createdAt)})`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-white p-3">
                        <h3 className="mb-2 text-sm font-bold text-stone-800">
                            問題回報
                        </h3>
                        <textarea
                            className="min-h-20 w-full resize-none rounded border border-stone-300 bg-stone-50 p-2 text-xs text-stone-800 outline-none focus:border-amber-500 focus:bg-white"
                            aria-label="問題回報內容" value={issueReportText}
                            onChange={(e) => setIssueReportText(e.target.value)}
                            maxLength={500}
                            placeholder="簡短描述遇到的問題"
                        />
                        <button
                            className="mt-2 w-full rounded bg-stone-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={handleSubmitIssueReport}
                            disabled={!issueReportText.trim()}
                        >
                            送出回報
                        </button>
                        {issueReportStatus ? (
                            <p className="mt-2 text-xs text-stone-600">
                                {issueReportStatus}
                            </p>
                        ) : null}
                    </div>
                </div>
            </aside>

            {/* 主內容 */}
            <main id="workspace-main" className="workspace-main" inert={shouldShowLogin}>
                {demo ? <div className="demo-banner"><span>示範工作室 · 資料僅供體驗，重新整理後還原。</span><a href={window.location.pathname}>返回登入 <Icon name="arrow" size={14}/></a></div> : null}
                <div className="page-heading"><div><h1>{({dashboard:"工作室總覽",tasks:"所有任務",calendar:"行事曆",gantt:"專題甘特圖",drive:"雲端檔案目錄",files:"檔案協作規範",leaderboard:"團隊排行榜"})[activePage]}</h1><p>{({dashboard:"查看專題進度、截止事項與成員分工。",tasks:"搜尋、篩選與管理小組任務。",calendar:"按日期查看任務的開始與截止時間。",gantt:"查看任務時程、切換時間尺度與匯出提報圖表。",drive:"瀏覽專題雲端資料夾、查找檔案並開啟同名截圖。",files:"查看雲端上傳規則、命名範例與更新通知範本。",leaderboard:"查看成員完成數、積分與逾期紀錄。"})[activePage]}</p></div>{canCreateTasks?<button className="primary-button" onClick={()=>setShowComposer(!showComposer)} aria-expanded={showComposer}><Icon name="plus" size={18}/>新增任務</button>:null}</div>
                {actionMessage ? <div role="status" className="feedback success">{actionMessage}<button aria-label="關閉提示" onClick={()=>setActionMessage("")}><Icon name="close" size={16}/></button></div> : null}
                {actionError ? <div role="alert" className="feedback error">{actionError}<button aria-label="關閉錯誤" onClick={()=>setActionError("")}><Icon name="close" size={16}/></button></div> : null}
                {showComposer && canCreateTasks ? <>                <section className="task-composer" aria-label="新增任務"><div className="section-title"><h2>新增任務</h2><button onClick={()=>setShowComposer(false)} aria-label="關閉新增任務"><Icon name="close"/></button></div><p>填寫標題、負責人與任務類型。日期可留空。</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                        <label className="form-field full-field"><span>任務標題</span><input
                            className="border p-2 flex-1 min-w-64 rounded"
                            ref={titleRef}
                            aria-label="任務標題"
                            maxLength={160}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="輸入任務標題"
                        /></label>

                        <label className="form-field "><span>任務類型</span><select
                            className="border p-2 rounded"
                            value={taskScheduleType}
                            onChange={(e) => setTaskScheduleType(e.target.value)}
                            aria-label="任務類型"
                            title="任務類型"
                        >
                            <option value="小作業">小作業</option>
                            <option value="期中作業">期中作業</option>
                            <option value="期末作業">期末作業</option>
                            <option value="畢業專題">畢業專題</option>
                            <option value="其他">其他</option>
                        </select></label>

                        <label className="form-field "><span>指派對象</span><select
                            className="border p-2 rounded"
                            value={assigneeInput}
                            onChange={(e) => setAssigneeInput(e.target.value)}
                            aria-label="指派對象"
                            title="指派對象"
                        >
                            {assignableOptions.map((member) => (
                                <option key={member} value={member}>
                                    {member}
                                </option>
                            ))}
                        </select></label>

                        <label className="form-field "><span>重要度</span><select
                            className="border p-2 rounded"
                            value={importanceInput}
                            onChange={(e) => setImportanceInput(Number(e.target.value))}
                            aria-label="重要度"
                            title="重要度"
                        >
                            {IMPORTANCE_OPTIONS.map((level) => (
                                <option key={level} value={level}>
                                    {"★".repeat(level)}
                                </option>
                            ))}
                        </select></label>

                        <label className="form-field"><span>開始時間（選填）</span><input
                            type="datetime-local"
                            className="border p-2 rounded w-56"
                            value={startInput}
                            onChange={(e) => setStartInput(e.target.value)}
                            aria-label="開始時間"
                            title="開始時間"
                        /></label>

                        <label className="form-field"><span>截止時間（選填）</span><input
                            type="datetime-local"
                            className="border p-2 rounded w-64"
                            value={deadlineInput}
                            onChange={(e) => setDeadlineInput(e.target.value)}
                            aria-label="截止時間"
                            title="截止時間"
                        /></label>

                        <button
                            className="bg-blue-500 text-white px-3 rounded disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!canCreateTasks || busy || !input.trim()}
                            onClick={() => runAction(handleAddTask, "任務已建立")}
                        >
                            {busy ? "儲存中…" : "建立任務"}
                        </button>
                    </div>

                    <textarea
                        className="border p-2 rounded w-full min-h-20"
                        value={detailsInput}
                        onChange={(e) => setDetailsInput(e.target.value)}
                        aria-label="詳細內容" placeholder="補上執行方式、參考連結或完成條件…"
                    />
                </section></> : null}
                {activePage === "tasks" || activePage === "calendar" ? <div className="task-tools"><label className="search-field"><Icon name="search" size={18}/><input aria-label="搜尋任務" placeholder="搜尋任務、內容或組員…" value={searchQuery} onChange={event=>setSearchQuery(event.target.value)}/></label><select aria-label="任務排序" value={sortOrder} onChange={event=>setSortOrder(event.target.value)}><option value="deadline">截止時間優先</option><option value="importance">重要度優先</option><option value="newest">最近新增</option></select><button className="secondary-button" onClick={()=>{setTaskFilters({assignee:currentUser?.name ?? "all",taskType:"all",status:"all",deadlineTone:"all"});setSearchQuery("")}}>我的任務</button><button className="secondary-button" onClick={()=>{setSearchQuery("");setTaskFilters({assignee:"all",taskType:"all",status:"all",deadlineTone:"all"})}}>清除篩選</button><button className="secondary-button" disabled={!filteredTasks.length} onClick={exportTasks}><Icon name="download" size={16}/>匯出 CSV</button></div> : null}
                {activePage === "drive" ? <DriveDirectory key={`${currentUser?.uid}:${currentUser?.groupId}`} demo={demo} user={currentUser}/> : activePage === "files" ? <FileGuidelines/> : tasksError ? (
                    <div className="bg-white p-4 rounded-xl shadow">
                        <h2 className="font-bold mb-2">資料讀取失敗</h2>
                        <p className="text-sm text-red-600">
                            {tasksError}
                        </p>
                    </div>
                ) : activePage === "calendar" ? (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-xl shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg">行事曆篩選</h2>
                                <p className="text-sm text-gray-500">
                                    目前篩選 {filteredTasks.length} / {tasks.length} 個任務
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        指派對象
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="篩選指派對象" value={taskFilters.assignee}
                                        onChange={(e) =>
                                            updateTaskFilter("assignee", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        {filterAssigneeOptions.map((member) => (
                                            <option key={member} value={member}>
                                                {member}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        任務類型
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="篩選任務類型" value={taskFilters.taskType}
                                        onChange={(e) =>
                                            updateTaskFilter("taskType", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        {TASK_TYPE_OPTIONS.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        截止狀態
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="篩選截止狀態" value={taskFilters.deadlineTone}
                                        onChange={(e) =>
                                            updateTaskFilter("deadlineTone", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        <option value="soon">將近</option>
                                        <option value="overdue">已超期</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        執行狀態
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="篩選執行狀態" value={taskFilters.status}
                                        onChange={(e) =>
                                            updateTaskFilter("status", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        <option value="todo">未執行</option>
                                        <option value="doing">執行中</option>
                                        <option value="done">已完成</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow">
                            <div className="flex items-center justify-between mb-3">
                                <button aria-label="上一個月"
                                    className="px-2 py-1 border rounded text-gray-700"
                                    onClick={() =>
                                        setCalendarCursor(
                                            new Date(
                                                calendarYear,
                                                calendarMonth - 1,
                                                1
                                            )
                                        )
                                    }
                                >
                                    <span aria-hidden="true">←</span>
                                </button>
                                <h2 className="font-bold">
                                    {new Intl.DateTimeFormat("zh-TW", {
                                        year: "numeric",
                                        month: "long",
                                    }).format(calendarCursor)}
                                </h2>
                                <button aria-label="下一個月"
                                    className="px-2 py-1 border rounded text-gray-700"
                                    onClick={() =>
                                        setCalendarCursor(
                                            new Date(
                                                calendarYear,
                                                calendarMonth + 1,
                                                1
                                            )
                                        )
                                    }
                                >
                                    <span aria-hidden="true">→</span>
                                </button>
                            </div>

                            <div className="calendar-legend"><button className="secondary-button" onClick={()=>{setCalendarCursor(new Date());setSelectedDateKey(dateKey(new Date()))}}>回到今天</button><span>點選日期查看當天任務</span><span>● 有任務 <span className="text-amber-700">● 即將到期</span> <span className="text-red-600">● 已逾期</span></span></div>
                            <div className="grid grid-cols-7 text-xs text-gray-500 mb-2 text-center">
                                <div className="text-center">日</div>
                                <div className="text-center">一</div>
                                <div className="text-center">二</div>
                                <div className="text-center">三</div>
                                <div className="text-center">四</div>
                                <div className="text-center">五</div>
                                <div className="text-center">六</div>
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                                {calendarCells.map((cell, idx) => {
                                    const key = cell.key
                                    const dayTasks = getFilteredCalendarTasksForDayKey(key)
                                    const dayOverdue = dayTasks.some(
                                        (t) =>
                                            t.status !== "done" &&
                                            isOverdue(t)
                                    )
                                    const daySoon = dayTasks.some(
                                        (t) => getDeadlineTone(t) === "soon"
                                    )

                                    return (
                                        <button
                                            key={`${cell.key ?? "empty"}-${idx}`}
                                            aria-label={key ? `${key}，${dayTasks.length} 項任務${dayOverdue ? "，有逾期任務" : daySoon ? "，有即將到期任務" : ""}` : "空白日期"}
                                            aria-pressed={!!key && key === effectiveSelectedDateKey}
                                            disabled={!key}
                                            onClick={() => setSelectedDateKey(key)}
                                            className={[
                                                "h-10 border rounded text-sm flex flex-col items-center justify-center transition duration-150 hover:scale-105 hover:bg-teal-50 hover:border-teal-300 disabled:hover:scale-100 disabled:hover:bg-white",
                                                key ===
                                                effectiveSelectedDateKey
                                                    ? "bg-gray-100 border-gray-400"
                                                    : "bg-white",
                                                dayOverdue
                                                    ? "border-red-500"
                                                    : daySoon
                                                      ? "border-yellow-500"
                                                      : "",
                                            ].join(" ")}
                                        >
                                            <div className="leading-none">
                                                {cell.date ? cell.date.getDate() : ""}
                                            </div>
                                            {dayOverdue ? (
                                                <div className="w-2 h-2 mt-1 bg-red-500 rounded-full"></div>
                                            ) : daySoon ? (
                                                <div className="w-2 h-2 mt-1 bg-yellow-500 rounded-full"></div>
                                            ) : dayTasks.length > 0 ? (
                                                <div className="w-2 h-2 mt-1 bg-blue-500 rounded-full"></div>
                                            ) : null}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow">
                            <h3 className="font-bold mb-3">日期：{effectiveSelectedDateKey}</h3>
                            {getFilteredCalendarTasksForDayKey(effectiveSelectedDateKey).length === 0 ? (
                                <p className="text-gray-600">此日期沒有任務</p>
                            ) : (
                                <div className="space-y-2">
                                    {getFilteredCalendarTasksForDayKey(effectiveSelectedDateKey)
                                        .map((task) => (
                                            <div
                                                key={task.id}
                                                className={`p-3 border rounded ${getTaskCardClass(task)}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-medium">
                                                            {task.text}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {task.taskType} · {STATUS_LABELS[task.status] ?? task.status}
                                                        </p>
                                                    </div>
                                                    {renderAssigneeBadge(task)}
                                                </div>
                                                {renderTaskMeta(task, {
                                                    showFinished: true,
                                                    collapsibleDetails: true,
                                                    showAssignee: false,
                                                })}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : activePage === "gantt" ? (
                    <GanttChart items={ganttItems} taskCount={tasks.filter(task=>task.taskType==="畢業專題").length} projectName={currentUser?.groupName} demo={demo} members={filterAssigneeOptions} filters={ganttFilters} onFilter={updateGanttFilter} colors={ganttColors} colorOptions={GANTT_COLOR_OPTIONS} onColor={updateGanttColor} onMove={moveGanttItem} getColor={getGanttColor} matchesAssignee={matchesAssigneeFilter} getDeadlineTone={getDeadlineTone}/>
                ) : activePage === "leaderboard" ? (
                    <div className="space-y-6">
                        <div className="bg-white/90 p-5 rounded-xl shadow border border-slate-100">
                            <h2 className="font-bold text-lg mb-5">排行榜</h2>
                            <div className="flex justify-center mb-6">
                                    <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-lg transition duration-150 ease-out hover:scale-[1.02]">
                                        <p className="text-sm font-semibold text-amber-700">
                                            {leaderboardHasScores ? `第 ${leaderboardWithRanks[0]?.rank ?? 1} 名` : "尚無排名"}
                                        </p>
                                        <p className="hidden">
                                            第 {leaderboardWithRanks[0]?.rank} 名
                                        </p>
                                        <h3 className="text-4xl font-bold text-slate-900 mt-1">
                                            {leaderboardHasScores ? leaderboardWithRanks[0]?.member : "尚無排名"}
                                        </h3>
                                        <div className="text-5xl font-bold text-amber-600 mt-3">
                                            {leaderboardHasScores ? leaderboardWithRanks[0]?.points : 0}
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 mt-5 text-sm">
                                            <div className="rounded-lg bg-white/70 p-3">
                                                完成<br />
                                                <span className="font-bold">
                                                    {leaderboardHasScores ? leaderboardWithRanks[0]?.completedCount : 0}
                                                </span>
                                            </div>
                                            <div className="rounded-lg bg-white/70 p-3">
                                                積分<br />
                                                <span className="font-bold">
                                                    {leaderboardHasScores ? leaderboardWithRanks[0]?.points : 0}
                                                </span>
                                            </div>
                                            <div className="rounded-lg bg-white/70 p-3">
                                                超時<br />
                                                <span className="font-bold">
                                                    {leaderboardHasScores ? leaderboardWithRanks[0]?.overdueCount : 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>



                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(leaderboardHasScores ? leaderboardWithRanks.slice(1) : leaderboardWithRanks).map((entry, index) => (
                                    <div
                                        key={entry.member}
                                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-150 ease-out hover:scale-[1.01] hover:bg-teal-50 hover:shadow-md"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    {leaderboardHasScores ? `第 ${entry.rank} 名` : "尚無排名"}
                                                </p>
                                                <p className="hidden">
                                                    第 {entry.rank} 名
                                                </p>
                                                <p className="hidden" data-unused-rank="legacy">
                                                    第 {index + 2} 名
                                                </p>
                                                <h3 className="text-2xl font-bold">
                                                    {entry.member}
                                                </h3>
                                            </div>
                                            <span className="text-3xl font-bold text-indigo-600">
                                                {entry.points}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-4 text-sm text-slate-600">
                                            <div>完成 {entry.completedCount}</div>
                                            <div>積分 {entry.points}</div>
                                            <div>超時 {entry.overdueCount}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : activePage === "tasks" ? (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-xl shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg">任務</h2>
                                <p className="text-sm text-gray-500">
                                    顯示 {filteredTasks.length} / {tasks.length} 個任務
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        指派對象
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="篩選指派對象" value={taskFilters.assignee}
                                        onChange={(e) =>
                                            updateTaskFilter("assignee", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        {filterAssigneeOptions.map((member) => (
                                            <option key={member} value={member}>
                                                {member}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        任務類型
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="篩選任務類型" value={taskFilters.taskType}
                                        onChange={(e) =>
                                            updateTaskFilter("taskType", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        {TASK_TYPE_OPTIONS.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        截止狀態
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="篩選截止狀態" value={taskFilters.deadlineTone}
                                        onChange={(e) =>
                                            updateTaskFilter("deadlineTone", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        <option value="soon">將近</option>
                                        <option value="overdue">已超期</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        執行狀態
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="篩選執行狀態" value={taskFilters.status}
                                        onChange={(e) =>
                                            updateTaskFilter("status", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        <option value="todo">未執行</option>
                                        <option value="doing">執行中</option>
                                        <option value="done">已完成</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow">
                            {filteredTasks.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    沒有符合篩選條件的任務
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                                    {filteredTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className={`p-4 border rounded-xl min-h-52 ${getTaskCardClass(task)}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p
                                                        className={
                                                            task.status === "done"
                                                                ? "font-medium line-through text-gray-500"
                                                                : "font-medium"
                                                        }
                                                    >
                                                        {task.text}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {task.taskType} · {STATUS_LABELS[task.status] ?? task.status}
                                                    </p>
                                                </div>
                                                {renderAssigneeBadge(task)}
                                            </div>

                                            {renderTaskMeta(task, {
                                                showFinished: true,
                                                showAssignee: false,
                                                collapsibleDetails: true,
                                            })}

                                            <div className="flex gap-3 mt-2">
                                                {task.status === "todo" && canActOnTask(task) ? (
                                                    <button
                                                        className="text-xs text-blue-500"
                                                        onClick={() => runAction(() => handleStartTask(task))}
                                                    >
                                                        → 開始
                                                    </button>
                                                ) : null}
                                                {task.status === "doing" && canActOnTask(task) ? (
                                                    <button
                                                        className="text-xs text-green-500"
                                                        onClick={() => runAction(() => handleCompleteTask(task))}
                                                    >
                                                        → 完成
                                                    </button>
                                                ) : null}
                                                {canEditTask(task) ? (
                                                <button
                                                    className="text-xs text-purple-500"
                                                    onClick={() => handleOpenEditTask(task)}
                                                >
                                                    → 編輯
                                                </button>
                                                ) : null}
                                                {canDeleteTasks ? (
                                                    <button
                                                        className="text-xs text-red-500"
                                                        onClick={() => runAction(() => handleDeleteTask(task))}
                                                    >
                                                        → 刪除
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <Overview tasks={tasks} user={currentUser} members={memberOptions} onNavigate={navigate} onTask={task=>{if(canEditTask(task)) handleOpenEditTask(task); else {setSearchQuery(task.text);setTaskFilters({assignee:"all",taskType:"all",status:"all",deadlineTone:"all"});navigate("tasks")}}} weeklyMvp={weeklyMvp} doneThisWeek={doneThisWeek} totalThisWeek={totalThisWeek}/>
                        <div className="section-title board-title"><h2>任務看板</h2><button className="text-action" onClick={()=>navigate("tasks")}>查看所有任務 <Icon name="arrow" size={16}/></button></div>
                <div className="task-board grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
                    {/* 未執行 */}
                    <div className="bg-white p-4 rounded shadow">
                        <h3 className="font-bold mb-3">未執行 <span className="board-count">{tasks.filter(t=>t.status==="todo").length}</span></h3>
                        <div className="space-y-3">
                            {tasks.filter((t) => t.status === "todo").length === 0 ? (
                                <p className="text-sm text-gray-500">目前沒有任務</p>
                            ) : (
                                tasks
                                    .filter((t) => t.status === "todo")
                                    .map((task) => (
                                        <div
                                            key={task.id}
                                            className={`p-2 border rounded ${getTaskCardClass(task)}`}
                                        >
                                            <p className="font-medium">{task.text}</p>
                                            {renderTaskMeta(task, {
                                                collapsibleDetails: true,
                                            })}
                                            <button
                                                className="text-xs text-blue-500 mt-2 disabled:cursor-not-allowed disabled:text-gray-300"
                                                disabled={!canActOnTask(task)}
                                                onClick={() => runAction(() => handleStartTask(task))}
                                            >
                                                → 開始
                                            </button>
                                            <button
                                                disabled={!canEditTask(task)} className="text-xs text-purple-500 mt-2"
                                                onClick={() =>
                                                    handleOpenEditTask(task)
                                                }
                                            >
                                                → 編輯
                                            </button>
                                            {canDeleteTasks ? (
                                                <button
                                                    className="text-xs text-red-500 mt-2"
                                                    onClick={() => runAction(() => handleDeleteTask(task))}
                                                >
                                                    → 刪除
                                                </button>
                                            ) : null}
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>

                    {/* 執行中 */}
                    <div className="bg-white p-4 rounded shadow">
                        <h3 className="font-bold mb-3">執行中 <span className="board-count">{tasks.filter(t=>t.status==="doing").length}</span></h3>
                        <div className="space-y-3">
                            {tasks.filter((t) => t.status === "doing").length === 0 ? (
                                <p className="text-sm text-gray-500">目前沒有任務</p>
                            ) : (
                                tasks
                                    .filter((t) => t.status === "doing")
                                    .map((task) => (
                                        <div
                                            key={task.id}
                                            className={`p-2 border rounded ${getTaskCardClass(task)}`}
                                        >
                                            <p className="font-medium">{task.text}</p>
                                            {renderTaskMeta(task, {
                                                showFinished: true,
                                                collapsibleDetails: true,
                                            })}
                                            <button
                                                className="text-xs text-green-500 mt-2 disabled:cursor-not-allowed disabled:text-gray-300"
                                                disabled={!canActOnTask(task)}
                                                onClick={() => runAction(() => handleCompleteTask(task))}
                                            >
                                                → 完成
                                            </button>
                                            <button
                                                disabled={!canEditTask(task)} className="text-xs text-purple-500 mt-2"
                                                onClick={() =>
                                                    handleOpenEditTask(task)
                                                }
                                            >
                                                → 編輯
                                            </button>
                                            {canDeleteTasks ? (
                                                <button
                                                    className="text-xs text-red-500 mt-2"
                                                    onClick={() => runAction(() => handleDeleteTask(task))}
                                                >
                                                    → 刪除
                                                </button>
                                            ) : null}
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>

                    {/* 執行完成 */}
                    <div className="bg-white p-4 rounded shadow">
                        <h3 className="font-bold mb-3">已完成 <span className="board-count">{tasks.filter(t=>t.status==="done").length}</span></h3>
                        <div className="space-y-3">
                            {tasks.filter((t) => t.status === "done").length === 0 ? (
                                <p className="text-sm text-gray-500">目前沒有任務</p>
                            ) : (
                                tasks
                                    .filter((t) => t.status === "done")
                                    .map((task) => (
                                        <div
                                            key={task.id}
                                            className={`p-2 border rounded ${getTaskCardClass(task)}`}
                                        >
                                            <p className="font-medium line-through text-gray-500">
                                                {task.text}
                                            </p>
                                            {renderTaskMeta(task, {
                                                showFinished: true,
                                                collapsibleDetails: true,
                                            })}
                                            <button
                                                disabled={!canEditTask(task)} className="text-xs text-purple-500 mt-2"
                                                onClick={() =>
                                                    handleOpenEditTask(task)
                                                }
                                            >
                                                → 編輯
                                            </button>
                                            {canDeleteTasks ? (
                                                <button
                                                    className="text-xs text-red-500 mt-2"
                                                    onClick={() => runAction(() => handleDeleteTask(task))}
                                                >
                                                    → 刪除
                                                </button>
                                            ) : null}
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>


                    </>
                )}
                {/* 編輯任務 Modal */}
                {editingTask && (
                    <dialog
                        ref={node => { if (node && !node.open) node.showModal() }}
                        onCancel={handleCancelEdit}
                        className="edit-backdrop" aria-label="編輯任務"
                        onClick={(e) => {
                            if (e.target === e.currentTarget)
                                handleCancelEdit()
                        }}
                    >
                        <div className="edit-dialog bg-white rounded-xl p-4 w-full max-w-xl shadow">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-lg">編輯任務</h3>
                                <button
                                    className="text-gray-500"
                                    onClick={handleCancelEdit}
                                >
                                    ✕
                                </button>
                            </div>

                            {editError && (
                                <p className="text-sm text-red-600">
                                    {editError}
                                </p>
                            )}

                            <div className="space-y-3">
                                <div>
                                    <div className="text-sm text-gray-600 mb-1">
                                        任務標題
                                    </div>
                                    <input
                                        className="border p-2 rounded w-full"
                                        aria-label="任務標題" value={editText}
                                        onChange={(e) =>
                                            setEditText(e.target.value)
                                        }
                                    />
                                </div>

                                <div>
                                    <div className="text-sm text-gray-600 mb-1">
                                        詳細內容
                                    </div>
                                    <textarea
                                        className="border p-2 rounded w-full min-h-24"
                                        aria-label="詳細內容" value={editDetails}
                                        onChange={(e) =>
                                            setEditDetails(e.target.value)
                                        }
                                    />
                                </div>

                                <div>
                                    <div className="text-sm text-gray-600 mb-1">
                                        指派對象
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="指派對象" value={editAssignee}
                                        onChange={(e) =>
                                            setEditAssignee(e.target.value)
                                        }
                                    >
                                        {assignableOptions.map((member) => (
                                            <option key={member} value={member}>
                                                {member}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="text-sm text-gray-600 mb-1">
                                        重要度
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="重要度" value={editImportance}
                                        onChange={(e) =>
                                            setEditImportance(Number(e.target.value))
                                        }
                                    >
                                        {IMPORTANCE_OPTIONS.map((level) => (
                                            <option key={level} value={level}>
                                                {"★".repeat(level)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="text-sm text-gray-600 mb-1">
                                        任務類型
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        aria-label="任務類型" value={editTaskType}
                                        onChange={(e) =>
                                            setEditTaskType(e.target.value)
                                        }
                                    >
                                        <option value="小作業">小作業</option>
                                        <option value="期中作業">期中作業</option>
                                        <option value="期末作業">期末作業</option>
                                        <option value="畢業專題">畢業專題</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="text-sm text-gray-600 mb-1">
                                        開始時間
                                    </div>
                                    <input
                                        type="datetime-local"
                                        className="border p-2 rounded w-full"
                                        aria-label="開始時間" value={editStartInput}
                                        onChange={(e) =>
                                            setEditStartInput(
                                                e.target.value
                                            )
                                        }
                                    />
                                </div>

                                <div>
                                    <div className="text-sm text-gray-600 mb-1">
                                        截止時間
                                    </div>
                                    <input
                                        type="datetime-local"
                                        className="border p-2 rounded w-full"
                                        aria-label="截止時間" value={editDeadlineInput}
                                        onChange={(e) =>
                                            setEditDeadlineInput(
                                                e.target.value
                                            )
                                        }
                                    />
                                </div>

                                {editingTask.status === "done" && (
                                    <div>
                                        <div className="text-sm text-gray-600 mb-1">
                                            完成時間
                                        </div>
                                        <input
                                            type="datetime-local"
                                            className="border p-2 rounded w-full"
                                            aria-label="完成時間" value={editFinishedInput}
                                            onChange={(e) =>
                                                setEditFinishedInput(
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                )}

                                <div className="flex gap-2 pt-1">
                                    <button
                                        disabled={busy} className="bg-blue-500 text-white px-3 py-2 rounded"
                                        onClick={() => runAction(() => handleSaveEditTask(editingTask))}
                                    >
                                        儲存
                                    </button>
                                    <button
                                        className="border px-3 py-2 rounded"
                                        onClick={handleCancelEdit}
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        </div>
                    </dialog>
                )}

            </main>
        </div>
    )
}
