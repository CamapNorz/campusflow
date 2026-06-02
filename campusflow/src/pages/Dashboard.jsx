import { useEffect, useState } from "react"
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

export default function Dashboard() {
    const [currentUser, setCurrentUser] = useState(null)
    const [loginName, setLoginName] = useState("")
    const [loginRole, setLoginRole] = useState("member")
    const [projectNameInput, setProjectNameInput] = useState("")
    const [groupCodeInput, setGroupCodeInput] = useState("")
    const [copiedGroupCode, setCopiedGroupCode] = useState(false)
    const [copiedLoginUrl, setCopiedLoginUrl] = useState(false)
    const [loginError, setLoginError] = useState("")
    const [authReady, setAuthReady] = useState(false)
    const [isEditingName, setIsEditingName] = useState(false)
    const [nameDraft, setNameDraft] = useState("")
    const [nameError, setNameError] = useState("")
    const [issueReportText, setIssueReportText] = useState("")
    const [issueReportStatus, setIssueReportStatus] = useState("")
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
    const [tasks, setTasks] = useState([])
    const [tasksError, setTasksError] = useState(null)
    const [activePage, setActivePage] = useState("dashboard") // dashboard | calendar
    const [calendarCursor, setCalendarCursor] = useState(() => new Date())
    const [selectedDateKey, setSelectedDateKey] = useState(null)
    const [expandedTaskIds, setExpandedTaskIds] = useState({})
    const [ganttOrder, setGanttOrder] = useState(() => {
        if (typeof window === "undefined") return []
        try {
            return JSON.parse(window.localStorage.getItem("ganttOrder") ?? "[]")
        } catch {
            return []
        }
    })
    const [ganttColors, setGanttColors] = useState(() => {
        if (typeof window === "undefined") return {}
        try {
            return JSON.parse(window.localStorage.getItem("ganttColors") ?? "{}")
        } catch {
            return {}
        }
    })
    const [ganttFilters, setGanttFilters] = useState({
        assignee: "all",
        deadlineTone: "all",
        status: "all",
    })
    const [ganttWindow, setGanttWindow] = useState([0, 100])
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
    const [teamUsers, setTeamUsers] = useState([])
    const [membershipReady, setMembershipReady] = useState(false)
    const userAgent =
        typeof navigator === "undefined" ? "" : navigator.userAgent
    const isEmbeddedBrowser =
        /Line|FBAN|FBAV|Instagram|Messenger|MicroMessenger|wv|WebView/i.test(
            userAgent
        )

    useEffect(() => {
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
    }, [db, currentUser?.groupId, currentUser?.name, membershipReady])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthUser(user)
            setAuthReady(true)
        })

        return () => unsubscribe()
    }, [auth])

    useEffect(() => {
        if (!authUser) {
            setUserProfile(null)
            setMembershipReady(false)
            return
        }

        const userRef = doc(db, "users", authUser.uid)

        const unsubscribeUser = onSnapshot(
            userRef,
            (snapshot) => {
                const data = snapshot.data() ?? {}
                setUserProfile({
                    uid: authUser.uid,
                    name: data.name ?? authUser.displayName ?? "",
                    role: data.role ?? "member",
                    groupId: data.groupId ?? "",
                    lastNameChangedAt: data.lastNameChangedAt ?? null,
                })
            },
            () => {
                setUserProfile({
                    uid: authUser.uid,
                    name: authUser.displayName ?? "",
                    role: "member",
                    groupId: "",
                    lastNameChangedAt: null,
                })
            }
        )

        return () => unsubscribeUser()
    }, [authUser, db])

    useEffect(() => {
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
    }, [userProfile?.groupId, db])

    useEffect(() => {
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
    }, [userProfile?.groupId, db, membershipReady])

    useEffect(() => {
        if (!authUser) {
            setCurrentUser(null)
            return
        }

        setCurrentUser({
            uid: userProfile?.uid ?? authUser.uid,
            name: userProfile?.name ?? authUser.displayName ?? "",
            role:
                currentGroup?.leaderUid === authUser.uid ? "leader" : "member",
            groupId: userProfile?.groupId ?? "",
            groupName: currentGroup?.name ?? "",
            isLeader: currentGroup?.leaderUid === authUser.uid,
            lastNameChangedAt: userProfile?.lastNameChangedAt ?? null,
        })
    }, [authUser, userProfile, currentGroup])

    useEffect(() => {
        if (!currentUser?.name || isEditingName) return
        setNameDraft(currentUser.name)
        setNameError("")
    }, [currentUser?.name, isEditingName])

    useEffect(() => {
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
    }, [authUser, db, userProfile?.groupId, userProfile?.name, currentGroup?.leaderUid])

    useEffect(() => {
        if (typeof window === "undefined") return
        window.localStorage.setItem("ganttOrder", JSON.stringify(ganttOrder))
    }, [ganttOrder])

    useEffect(() => {
        if (typeof window === "undefined") return
        window.localStorage.setItem("ganttColors", JSON.stringify(ganttColors))
    }, [ganttColors])

    useEffect(() => {
        if (!currentUser) return
        if (!currentUser.isLeader) {
            setAssigneeInput(currentUser.name)
            setEditAssignee(currentUser.name)
        } else {
            setAssigneeInput((current) => current || currentUser.name)
        }
    }, [currentUser])

    const doneCount = tasks.filter((t) => t.status === "done").length
    const undoneCount = tasks.filter((t) => t.status !== "done").length
    const totalCount = tasks.length
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
        currentUser?.isLeader
            ? assigneeOptions
            : currentUser?.name
              ? [currentUser.name]
              : []
    const canDeleteTasks = currentUser?.isLeader
    const isTaskOwner = (task) =>
        task?.assignee === currentUser?.name ||
        task?.createdBy === authUser?.uid
    const canEditTask = (task) => currentUser?.isLeader || isTaskOwner(task)
    const canActOnTask = (task) => isTaskOwner(task)

    const startOfThisWeek = (() => {
        const now = new Date()
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
    const isThisWeekComplete = totalThisWeek > 0 && doneThisWeek === totalThisWeek
    const weeklyMvp = memberOptions.map((member) => ({
        member,
        completed: tasksThisWeek.filter(
            (task) =>
                (task.assignee === member || task.assignee === ALL_ASSIGNEE) &&
                task.status === "done"
        ).length,
    })).sort((a, b) => b.completed - a.completed)[0]

    const progressPercent = totalCount
        ? Math.round((doneCount / totalCount) * 100)
        : 0

    const now = new Date()

    const isOverdue = (task) => {
        const d = task?.deadlineAt?.toDate ? task.deadlineAt.toDate() : null
        return task.status !== "done" && d && d.getTime() < now.getTime()
    }

    // 進度條顯示用：未完成任務依期限狀態切成藍/黃/紅
    const overdueCount = tasks.filter((t) => isOverdue(t)).length
    const todoSegmentCount = tasks.filter(
        (t) => t.status === "todo" && !isOverdue(t)
    ).length
    const doingSegmentCount = tasks.filter(
        (t) => t.status === "doing" && !isOverdue(t)
    ).length

    const barTotalCount = totalCount
    const todoPct = barTotalCount ? (todoSegmentCount / barTotalCount) * 100 : 0
    const doingPct = barTotalCount ? (doingSegmentCount / barTotalCount) * 100 : 0
    const overduePct = barTotalCount ? (overdueCount / barTotalCount) * 100 : 0
    // 用剩餘值避免浮點四捨五入造成總和超過 100%
    const donePct = barTotalCount
        ? Math.max(0, 100 - (todoPct + doingPct + overduePct))
        : 0

    const GANTT_RANGE_START = new Date(2026, 4, 1, 0, 0, 0, 0) // 2026/05/01
    const GANTT_RANGE_END = new Date(2028, 5, 30, 23, 59, 59, 999) // 2028/06/30

    const ganttItems = tasks
        .filter((task) => task.taskType === "畢業專題")
        .map((task) => {
            const startDate =
                tsToDate(task.startedAt) ?? tsToDate(task.createdAt)
            const endDate = tsToDate(task.deadlineAt) ?? tsToDate(task.finishedAt)
            return startDate && endDate ? { task, startDate, endDate } : null
        })
        .filter(Boolean)
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

    const ganttRangeStart = GANTT_RANGE_START
    const ganttRangeEnd = GANTT_RANGE_END

    const ganttTotalMs = Math.max(
        1,
        ganttRangeEnd.getTime() - ganttRangeStart.getTime()
    )

    const ganttMonthTicks = []
    for (
        let d = new Date(ganttRangeStart.getFullYear(), ganttRangeStart.getMonth(), 1);
        d <= ganttRangeEnd;
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    ) {
        ganttMonthTicks.push(new Date(d))
    }

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
                        {false ? (
                            <div className="mt-2 rounded border border-amber-200 bg-white/70 p-2 text-xs text-stone-600">
                                <div className="font-semibold text-stone-800">
                                    {currentUser.groupName}
                                </div>
                                {currentUser.isLeader ? (
                                    <div className="mt-1 break-all">
                                        空間代碼：{currentUser.groupId}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {false ? (
                            <div className="mt-2 rounded border border-amber-200 bg-white/70 p-2 text-xs text-stone-600">
                                <div className="font-semibold text-stone-800">
                                    {currentUser.groupName}
                                </div>
                                {currentUser.isLeader ? (
                                    <div className="mt-1 break-all">
                                        空間代碼：{currentUser.groupId}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {false ? (
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
        if (!text) return

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

        await addDoc(
            collection(db, "groups", currentUser.groupId, "tasks"),
            newTask
        )
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
        !nameChangeAvailableAt || nameChangeAvailableAt.getTime() <= Date.now()

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

    const needsInitialSetup = authReady && authUser && !userProfile?.groupId
    const shouldShowLogin = authReady && (!authUser || needsInitialSetup)

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

    const getDateAtGanttPercent = (percent) =>
        new Date(
            GANTT_RANGE_START.getTime() +
                (ganttTotalMs * Math.min(100, Math.max(0, percent))) / 100
        )

    const pageGanttRangeStart = getDateAtGanttPercent(ganttWindow[0])
    const pageGanttRangeEnd = getDateAtGanttPercent(ganttWindow[1])
    const pageGanttTotalMs = Math.max(
        1,
        pageGanttRangeEnd.getTime() - pageGanttRangeStart.getTime()
    )
    const pageGanttDays = pageGanttTotalMs / DAY_MS
    const pageGanttTicks = []
    const pushGanttTick = (date, label = "") => {
        if (date < pageGanttRangeStart || date > pageGanttRangeEnd) return
        pageGanttTicks.push({ date: new Date(date), label })
    }
    const formatGanttMonthLabel = (date) =>
        date.toLocaleDateString("zh-TW", {
            year: "2-digit",
            month: "2-digit",
        })
    if (pageGanttDays <= 31) {
        for (
            let d = new Date(pageGanttRangeStart.getFullYear(), pageGanttRangeStart.getMonth(), pageGanttRangeStart.getDate());
            d <= pageGanttRangeEnd;
            d.setDate(d.getDate() + 1)
        ) {
            pushGanttTick(d, d.getDate() === 1 ? formatGanttMonthLabel(d) : "")
        }
    } else if (pageGanttDays <= 183) {
        for (
            let month = new Date(pageGanttRangeStart.getFullYear(), pageGanttRangeStart.getMonth(), 1);
            month <= pageGanttRangeEnd;
            month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
        ) {
            pushGanttTick(month, formatGanttMonthLabel(month))
            pushGanttTick(new Date(month.getFullYear(), month.getMonth(), 11))
            pushGanttTick(new Date(month.getFullYear(), month.getMonth(), 21))
        }
    } else {
        for (
            let d = new Date(pageGanttRangeStart.getFullYear(), pageGanttRangeStart.getMonth(), 1);
            d <= pageGanttRangeEnd;
            d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        ) {
            pushGanttTick(d, formatGanttMonthLabel(d))
        }
    }
    const pageGanttItems = ganttItems.filter((item) => {
        const task = item.task
        if (ganttFilters.assignee !== "all" && task.assignee !== ganttFilters.assignee) {
            return false
        }
        if (
            ganttFilters.deadlineTone !== "all" &&
            getDeadlineTone(task) !== ganttFilters.deadlineTone
        ) {
            return false
        }
        if (ganttFilters.status !== "all" && task.status !== ganttFilters.status) {
            return false
        }
        return (
            item.startDate >= pageGanttRangeStart &&
            item.endDate <= pageGanttRangeEnd
        )
    })

    const handleDeleteTask = async (task) => {
        if (!canDeleteTasks) return
        await deleteDoc(doc(db, "groups", currentUser.groupId, "tasks", task.id))
    }

    const handleStartTask = async (task) => {
        if (!canActOnTask(task)) return
        await updateDoc(doc(db, "groups", currentUser.groupId, "tasks", task.id), {
            status: "doing",
            done: false,
            startedAt: serverTimestamp(),
            finishedAt: null,
        })
    }

    const handleCompleteTask = async (task) => {
        if (!canActOnTask(task)) return
        await updateDoc(doc(db, "groups", currentUser.groupId, "tasks", task.id), {
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
        const nextText = editText.trim()
        if (!nextText) {
            setEditError("請填寫任務標題")
            return
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

        await updateDoc(doc(db, "groups", currentUser.groupId, "tasks", task.id), payload)
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

    const updateGanttWindow = (edge, value) => {
        const nextValue = Number(value)
        setGanttWindow(([start, end]) => {
            if (edge === "start") {
                return [Math.min(nextValue, end - 1), end]
            }
            return [start, Math.max(nextValue, start + 1)]
        })
    }

    const filteredTasks = tasks.filter((task) => {
        if (taskFilters.assignee !== "all" && task.assignee !== taskFilters.assignee) {
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
    })

    const getFilteredCalendarTasksForDayKey = (key) =>
        getTasksForDayKey(key).filter((task) => filteredTasks.includes(task))

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200 font-sans">
            {currentUser?.groupName ? (
                <div className="fixed left-64 right-0 top-0 z-30 border-b border-amber-200 bg-stone-50/95 px-6 py-4 text-center shadow-sm backdrop-blur">
                    <h1 className="text-3xl font-bold text-stone-900">
                        {currentUser.groupName}
                    </h1>
                </div>
            ) : null}
            {shouldShowLogin ? (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/50 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-stone-50 p-6 shadow-xl">
                        <h2 className="text-2xl font-bold text-stone-900">
                            進入 CampusFlow
                        </h2>
                        <p className="mt-1 text-sm text-stone-600">
                            輸入匿名並選擇身份，系統會用 Firebase 匿名登入建立本次身份。
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
                        {needsInitialSetup ? (
                        <div className="mt-5 space-y-3">
                            <div>
                                <label className="text-sm text-stone-600">
                                    匿名
                                </label>
                                <input
                                    className="mt-1 w-full rounded border border-stone-300 bg-stone-100 p-2 text-sm text-stone-600"
                                    value={loginName}
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
                                    value={loginRole}
                                    onChange={(e) => setLoginRole(e.target.value)}
                                >
                                    <option value="member">組員</option>
                                    <option value="leader">組長</option>
                                </select>
                            </div>
                            {loginRole === "leader" ? (
                                <div>
                                    <label className="text-sm text-stone-600">
                                        畢業專題名稱
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded border border-stone-300 bg-white p-2"
                                        value={projectNameInput}
                                        onChange={(e) =>
                                            setProjectNameInput(e.target.value)
                                        }
                                        placeholder="例如：智慧校園排程系統"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="text-sm text-stone-600">
                                        空間代碼
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded border border-stone-300 bg-white p-2"
                                        value={groupCodeInput}
                                        onChange={(e) =>
                                            setGroupCodeInput(e.target.value)
                                        }
                                        placeholder="請輸入組長提供的代碼"
                                    />
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
            <aside className="w-64 bg-stone-50/95 border-r border-amber-200 p-4 backdrop-blur">
                {currentUser ? (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        {isEditingName ? (
                            <div className="space-y-2">
                                <input
                                    className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-sm text-stone-800"
                                    value={nameDraft}
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
                                            {currentUser.isLeader ? "組長" : "組員"}
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
                        {false ? (
                            <div className="mt-2 rounded border border-amber-200 bg-white/70 p-2 text-xs text-stone-600">
                                <div className="font-semibold text-stone-800">
                                    {currentUser.groupName}
                                </div>
                                {currentUser.isLeader ? (
                                    <div className="mt-1 break-all">
                                        空間代碼：{currentUser.groupId}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
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
                        <button
                            className="mt-2 text-xs text-stone-500 hover:text-stone-900"
                            onClick={handleLogout}
                        >
                            登出
                        </button>
                    </div>
                ) : null}

                <nav className="space-y-2">
                    <button
                        className={[
                            "w-full rounded-lg px-3 py-2 text-left transition",
                            activePage === "dashboard"
                                ? "bg-amber-100 text-stone-950 font-medium"
                                : "text-stone-600 hover:bg-amber-50",
                        ].join(" ")}
                        onClick={() => setActivePage("dashboard")}
                    >
                        首頁
                    </button>
                    <button
                        className={[
                            "w-full rounded-lg px-3 py-2 text-left transition",
                            activePage === "tasks"
                                ? "bg-amber-100 text-stone-950 font-medium"
                                : "text-stone-600 hover:bg-amber-50",
                        ].join(" ")}
                        onClick={() => setActivePage("tasks")}
                    >
                        任務
                    </button>
                    <button
                        className={[
                            "w-full rounded-lg px-3 py-2 text-left transition",
                            activePage === "calendar"
                                ? "bg-amber-100 text-stone-950 font-medium"
                                : "text-stone-600 hover:bg-amber-50",
                        ].join(" ")}
                        onClick={() => setActivePage("calendar")}
                    >
                        行事曆
                    </button>
                    <button
                        className={[
                            "w-full rounded-lg px-3 py-2 text-left transition",
                            activePage === "gantt"
                                ? "bg-amber-100 text-stone-950 font-medium"
                                : "text-stone-600 hover:bg-amber-50",
                        ].join(" ")}
                        onClick={() => setActivePage("gantt")}
                    >
                        甘特圖
                    </button>
                    <button
                        className={[
                            "w-full rounded-lg px-3 py-2 text-left transition",
                            activePage === "leaderboard"
                                ? "bg-amber-100 text-stone-950 font-medium"
                                : "text-stone-600 hover:bg-amber-50",
                        ].join(" ")}
                        onClick={() => setActivePage("leaderboard")}
                    >
                        排行榜
                    </button>
                </nav>

                <div className="mt-6 space-y-4">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                        <h3 className="font-bold text-sm text-red-700 mb-2">
                            懸賞
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
                            value={issueReportText}
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
            <main className={`flex-1 p-6 ${currentUser?.groupName ? "pt-24" : ""}`}>
                {tasksError ? (
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
                                        value={taskFilters.assignee}
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
                                        value={taskFilters.taskType}
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
                                        value={taskFilters.deadlineTone}
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
                                        value={taskFilters.status}
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
                                <button
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
                                    ◀
                                </button>
                                <h2 className="font-bold">
                                    {new Intl.DateTimeFormat("zh-TW", {
                                        year: "numeric",
                                        month: "long",
                                    }).format(calendarCursor)}
                                </h2>
                                <button
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
                                    ▶
                                </button>
                            </div>

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
                                        .slice()
                                        .sort((a, b) => {
                                            const ad = tsToDate(a.deadlineAt) ?? tsToDate(a.createdAt)
                                            const bd = tsToDate(b.deadlineAt) ?? tsToDate(b.createdAt)
                                            return (ad?.getTime?.() ?? 0) - (bd?.getTime?.() ?? 0)
                                        })
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
                    <div className="space-y-4">
                        <div className="bg-white/90 p-4 rounded-xl shadow border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg">完整甘特圖</h2>
                                <p className="text-sm text-slate-500">
                                    顯示 {pageGanttItems.length} / {ganttItems.length} 個畢業專題
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <div className="text-xs text-slate-500 mb-1">
                                        指派對象
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        value={ganttFilters.assignee}
                                        onChange={(e) =>
                                            updateGanttFilter("assignee", e.target.value)
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
                                    <div className="text-xs text-slate-500 mb-1">
                                        截止狀態
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        value={ganttFilters.deadlineTone}
                                        onChange={(e) =>
                                            updateGanttFilter("deadlineTone", e.target.value)
                                        }
                                    >
                                        <option value="all">全部</option>
                                        <option value="soon">將近</option>
                                        <option value="overdue">已超期</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 mb-1">
                                        執行狀態
                                    </div>
                                    <select
                                        className="border p-2 rounded w-full"
                                        value={ganttFilters.status}
                                        onChange={(e) =>
                                            updateGanttFilter("status", e.target.value)
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

                        <div className="bg-stone-50/95 p-4 rounded-xl shadow border border-amber-200">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-amber-900">時間卷軸</h3>
                                <p className="text-sm text-stone-600">
                                    {pageGanttRangeStart.toLocaleDateString()} - {pageGanttRangeEnd.toLocaleDateString()}
                                </p>
                            </div>
                            <div className="relative h-14">
                                <div
                                    className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-50"
                                    style={{ left: `${ganttWindow[0]}%` }}
                                >
                                    {pageGanttRangeStart.toLocaleDateString()}
                                </div>
                                <div
                                    className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-50"
                                    style={{ left: `${ganttWindow[1]}%` }}
                                >
                                    {pageGanttRangeEnd.toLocaleDateString()}
                                </div>
                                <div className="absolute left-0 right-0 top-7 h-2 rounded-full bg-stone-200"></div>
                                <div
                                    className="absolute top-7 h-2 rounded-full bg-amber-600"
                                    style={{
                                        left: `${ganttWindow[0]}%`,
                                        width: `${ganttWindow[1] - ganttWindow[0]}%`,
                                    }}
                                ></div>
                                <input
                                    type="range"
                                    min="0"
                                    max="99"
                                    value={ganttWindow[0]}
                                    onChange={(e) => updateGanttWindow("start", e.target.value)}
                                    className="absolute top-4 left-0 w-full accent-amber-700"
                                    aria-label="時間尺度起點"
                                />
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={ganttWindow[1]}
                                    onChange={(e) => updateGanttWindow("end", e.target.value)}
                                    className="absolute top-8 left-0 w-full accent-amber-700"
                                    aria-label="時間尺度終點"
                                />
                            </div>
                        </div>

                        <div className="bg-white/90 p-4 rounded-xl shadow border border-slate-100 overflow-x-auto">
                            {pageGanttItems.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    目前沒有符合篩選與時間尺度的畢業專題任務
                                </p>
                            ) : (
                                <div className="min-w-[1100px]">
                                    <div className="flex items-end gap-2 text-xs text-slate-500 mb-3">
                                        <div className="w-[25rem] shrink-0 grid grid-cols-[1fr_3.5rem_6rem] gap-2">
                                            <div>任務</div>
                                            <div>排序</div>
                                            <div>顏色</div>
                                        </div>
                                        <div className="flex-1 h-8 relative border-b border-slate-200">
                                            {pageGanttTicks.map((tick) => {
                                                const leftPct =
                                                    ((tick.date.getTime() -
                                                        pageGanttRangeStart.getTime()) /
                                                        pageGanttTotalMs) *
                                                    100

                                                return (
                                                    <div
                                                        key={tick.date.getTime()}
                                                        className="absolute bottom-0 -translate-x-1/2 text-center"
                                                        style={{ left: `${leftPct}%` }}
                                                    >
                                                        <div className="h-2 border-l border-slate-300 mx-auto"></div>
                                                        {tick.label ? (
                                                            <div className="mt-1 whitespace-nowrap">
                                                                {tick.label}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {pageGanttItems.map((item, index) => {
                                            const startMs = item.startDate.getTime()
                                            const endMs = item.endDate.getTime()
                                            const leftPct =
                                                ((startMs - pageGanttRangeStart.getTime()) /
                                                    pageGanttTotalMs) *
                                                100
                                            const widthPct = Math.max(
                                                2,
                                                ((endMs - startMs) / pageGanttTotalMs) * 100
                                            )

                                            return (
                                                <div
                                                    key={item.task.id}
                                                    className="flex items-center gap-2 rounded-lg py-1 transition duration-150 ease-out hover:scale-[1.005] hover:bg-slate-50"
                                                >
                                                    <div className="w-[25rem] shrink-0 grid grid-cols-[1fr_3.5rem_6rem] gap-2 items-center">
                                                        <div className="text-sm truncate">
                                                            {item.task.text}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button
                                                                className="border rounded px-1 text-xs text-slate-600 disabled:opacity-30"
                                                                disabled={index === 0}
                                                                onClick={() =>
                                                                    moveGanttItem(item.task.id, -1)
                                                                }
                                                                title="上移"
                                                            >
                                                                ↑
                                                            </button>
                                                            <button
                                                                className="border rounded px-1 text-xs text-slate-600 disabled:opacity-30"
                                                                disabled={index === pageGanttItems.length - 1}
                                                                onClick={() =>
                                                                    moveGanttItem(item.task.id, 1)
                                                                }
                                                                title="下移"
                                                            >
                                                                ↓
                                                            </button>
                                                        </div>
                                                        <select
                                                            className="border rounded p-1 text-xs"
                                                            value={ganttColors[item.task.id] ?? ""}
                                                            onChange={(e) =>
                                                                updateGanttColor(item.task.id, e.target.value)
                                                            }
                                                        >
                                                            <option value="">自動</option>
                                                            {GANTT_COLOR_OPTIONS.map((color) => (
                                                                <option key={color.value} value={color.value}>
                                                                    {color.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex-1 h-5 bg-slate-100 rounded-full relative overflow-hidden">
                                                        <div
                                                            className={`absolute top-0 h-5 rounded-full ${getGanttColor(item.task)}`}
                                                            style={{
                                                                left: `${leftPct}%`,
                                                                width: `${widthPct}%`,
                                                            }}
                                                            title={`開始：${formatTs(
                                                                item.task.startedAt ?? item.task.createdAt
                                                            )}\n截止：${formatTs(item.task.deadlineAt)}`}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : activePage === "leaderboard" ? (
                    <div className="space-y-6">
                        <div className="bg-white/90 p-5 rounded-xl shadow border border-slate-100">
                            <h2 className="font-bold text-lg mb-5">排行榜</h2>
                            {true ? (
                                <div className="flex justify-center mb-6">
                                    <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-lg transition duration-150 ease-out hover:scale-[1.02]">
                                        <p className="text-sm font-semibold text-amber-700">
                                            {leaderboardHasScores ? `第 ${leaderboardWithRanks[0]?.rank ?? 1} 名` : "尚無排名"}
                                        </p>
                                        <p className="hidden">
                                            第 {leaderboardWithRanks[0].rank} 名
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
                            ) : null}

                            {false ? (
                                <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                                    目前大家積分都是 0，暫不顯示名次。
                                </p>
                            ) : null}

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
                                            <span className="text-3xl font-bold text-teal-600">
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
                                        value={taskFilters.assignee}
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
                                        value={taskFilters.taskType}
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
                                        value={taskFilters.deadlineTone}
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
                                        value={taskFilters.status}
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
                                                                ? "font-medium line-through text-gray-400"
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
                                                        onClick={() => handleStartTask(task)}
                                                    >
                                                        → 開始
                                                    </button>
                                                ) : null}
                                                {task.status === "doing" && canActOnTask(task) ? (
                                                    <button
                                                        className="text-xs text-green-500"
                                                        onClick={() => handleCompleteTask(task)}
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
                                                        onClick={() => handleDeleteTask(task)}
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
                        {/* 上方統計 */}
                        <div className="grid grid-cols-4 gap-4 mb-6">

                    <div className="bg-white p-4 rounded-xl shadow">
                        <p className="text-gray-500">事項總數</p>
                        <h2 className="text-2xl font-bold">{totalCount}</h2>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow">
                        <p className="text-gray-500">未完成任務</p>
                        <h2 className="text-2xl font-bold">{undoneCount}</h2>
                    </div>

                    <div
                        className={`p-4 rounded-xl shadow ${
                            isThisWeekComplete
                                ? "bg-green-50 border border-green-400"
                                : "bg-yellow-50 border border-yellow-400"
                        }`}
                    >
                        <p className="text-gray-500">本週完成</p>
                        <h2 className="text-2xl font-bold">
                            {doneThisWeek}/{totalThisWeek}
                        </h2>
                    </div>

                    <div className="bg-white/90 p-4 rounded-xl shadow border border-slate-100">
                        <p className="text-gray-500">本週 MVP</p>
                        <h2 className="text-2xl font-bold">
                            {weeklyMvp?.completed ? weeklyMvp.member : "—"}
                        </h2>
                        <p className="text-xs text-gray-500">
                            完成 {weeklyMvp?.completed ?? 0} 項
                        </p>
                    </div>

                </div>

                {/* 甘特圖 */}
                <div className="bg-white p-4 rounded-xl shadow mb-6">
                    <p className="mb-2 font-medium">甘特圖</p>

                    {ganttItems.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            目前沒有有截止時間的任務
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="flex items-end gap-2 text-xs text-gray-500 mb-3 min-w-[900px]">
                                <div className="w-52 shrink-0">任務</div>
                                <div className="flex-1 h-8 relative border-b border-gray-200">
                                    {ganttMonthTicks.map((tick) => {
                                        const leftPct =
                                            ((tick.getTime() -
                                                ganttRangeStart.getTime()) /
                                                ganttTotalMs) *
                                            100

                                        return (
                                            <div
                                                key={`${tick.getFullYear()}-${tick.getMonth()}`}
                                                className="absolute bottom-0 -translate-x-1/2 text-center"
                                                style={{ left: `${leftPct}%` }}
                                            >
                                                <div className="h-2 border-l border-gray-300 mx-auto"></div>
                                                <div className="mt-1 whitespace-nowrap">
                                                    {tick.toLocaleDateString(
                                                        "zh-TW",
                                                        {
                                                            year: "2-digit",
                                                            month: "2-digit",
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2 min-w-[900px]">
                                {ganttItems
                                    .slice()
                                    .sort(
                                        (a, b) =>
                                            getImportance(b.task) -
                                                getImportance(a.task) ||
                                            a.startDate - b.startDate
                                    )
                                    .slice(0, 10)
                                    .map((item) => {
                                    const startMs = item.startDate.getTime()
                                    const endMs = item.endDate.getTime()
                                    const rangeStartMs =
                                        ganttRangeStart.getTime()
                                    const rangeEndMs =
                                        ganttRangeEnd.getTime()

                                    const clampedStartMs = Math.max(
                                        startMs,
                                        rangeStartMs
                                    )
                                    const clampedEndMs = Math.min(
                                        endMs,
                                        rangeEndMs
                                    )

                                    if (clampedEndMs <= clampedStartMs)
                                        return null

                                    const leftPct =
                                        ((clampedStartMs - rangeStartMs) /
                                            ganttTotalMs) *
                                        100
                                    const rawWidthPct =
                                        ((clampedEndMs - clampedStartMs) /
                                            ganttTotalMs) *
                                        100
                                    const widthPct = Math.min(100, Math.max(2, rawWidthPct))

                                    return (
                                        <div
                                            key={item.task.id}
                                            className="flex items-center gap-2"
                                        >
                                            <div className="w-52 text-sm truncate">
                                                {item.task.text}
                                            </div>
                                            <div className="flex-1 h-4 bg-gray-100 rounded relative overflow-hidden">
                                                <div
                                                    className={`absolute top-0 h-4 ${getGanttColor(item.task)} rounded`}
                                                    style={{
                                                        left: `${leftPct}%`,
                                                        width: `${widthPct}%`,
                                                    }}
                                                    title={`開始：${formatTs(
                                                        item.task.startedAt ?? item.task.createdAt
                                                    )}\n截止：${formatTs(
                                                        item.task.deadlineAt
                                                    )}`}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* 進度條 */}
                <div className="bg-white p-4 rounded-xl shadow mb-6">
                    <p className="mb-2 font-medium">畢業專題進度</p>

                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div className="flex h-3">
                            <div
                                className="bg-blue-500 h-3"
                                style={{ width: `${todoPct}%` }}
                            />
                            <div
                                className="bg-yellow-500 h-3"
                                style={{ width: `${doingPct}%` }}
                            />
                            <div
                                className="bg-red-500 h-3"
                                style={{ width: `${overduePct}%` }}
                            />
                            <div
                                className="bg-green-500 h-3"
                                style={{ width: `${donePct}%` }}
                            />
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 mt-2">
                        {progressPercent}% 已完成（未執行 {todoSegmentCount}、
                        執行中 {doingSegmentCount}、過期 {overdueCount}）
                    </p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow mb-3">
                    <div className="flex flex-wrap gap-2 mb-3">
                        <input
                            className="border p-2 flex-1 min-w-64 rounded"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="新增任務..."
                        />

                        <select
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
                        </select>

                        <select
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
                        </select>

                        <select
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
                        </select>

                        <input
                            type="datetime-local"
                            className="border p-2 rounded w-56"
                            value={startInput}
                            onChange={(e) => setStartInput(e.target.value)}
                            aria-label="開始時間"
                            title="開始時間"
                        />

                        <input
                            type="datetime-local"
                            className="border p-2 rounded w-64"
                            value={deadlineInput}
                            onChange={(e) => setDeadlineInput(e.target.value)}
                            aria-label="截止時間"
                            title="截止時間"
                        />

                        <button
                            className="bg-blue-500 text-white px-3 rounded"
                            onClick={handleAddTask}
                        >
                            新增
                        </button>
                    </div>

                    <textarea
                        className="border p-2 rounded w-full min-h-20"
                        value={detailsInput}
                        onChange={(e) => setDetailsInput(e.target.value)}
                        placeholder="詳細內容..."
                    />
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {/* 未執行 */}
                    <div className="bg-white p-4 rounded shadow">
                        <h3 className="font-bold mb-3">🟦 未執行</h3>
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
                                                className="text-xs text-blue-500 mt-2"
                                                onClick={() => handleStartTask(task)}
                                            >
                                                → 開始
                                            </button>
                                            <button
                                                className="text-xs text-purple-500 mt-2"
                                                onClick={() =>
                                                    handleOpenEditTask(task)
                                                }
                                            >
                                                → 編輯
                                            </button>
                                            {canDeleteTasks ? (
                                                <button
                                                    className="text-xs text-red-500 mt-2"
                                                    onClick={() =>
                                                        handleDeleteTask(task)
                                                    }
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
                        <h3 className="font-bold mb-3">🟨 執行中</h3>
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
                                                className="text-xs text-green-500 mt-2"
                                                onClick={() => handleCompleteTask(task)}
                                            >
                                                → 完成
                                            </button>
                                            <button
                                                className="text-xs text-purple-500 mt-2"
                                                onClick={() =>
                                                    handleOpenEditTask(task)
                                                }
                                            >
                                                → 編輯
                                            </button>
                                            {canDeleteTasks ? (
                                                <button
                                                    className="text-xs text-red-500 mt-2"
                                                    onClick={() =>
                                                        handleDeleteTask(task)
                                                    }
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
                        <h3 className="font-bold mb-3">🟩 執行完成</h3>
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
                                            <p className="font-medium line-through text-gray-400">
                                                {task.text}
                                            </p>
                                            {renderTaskMeta(task, {
                                                showFinished: true,
                                                collapsibleDetails: true,
                                            })}
                                            <button
                                                className="text-xs text-purple-500 mt-2"
                                                onClick={() =>
                                                    handleOpenEditTask(task)
                                                }
                                            >
                                                → 編輯
                                            </button>
                                            {canDeleteTasks ? (
                                                <button
                                                    className="text-xs text-red-500 mt-2"
                                                    onClick={() =>
                                                        handleDeleteTask(task)
                                                    }
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

                {/* 編輯任務 Modal */}
                {editingTask && (
                    <div
                        className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
                        onClick={(e) => {
                            if (e.target === e.currentTarget)
                                handleCancelEdit()
                        }}
                    >
                        <div className="bg-white rounded-xl p-4 w-full max-w-xl shadow">
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
                                        value={editText}
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
                                        value={editDetails}
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
                                        value={editAssignee}
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
                                        value={editImportance}
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
                                        value={editTaskType}
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
                                        value={editStartInput}
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
                                        value={editDeadlineInput}
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
                                            value={editFinishedInput}
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
                                        className="bg-blue-500 text-white px-3 py-2 rounded"
                                        onClick={() =>
                                            handleSaveEditTask(editingTask)
                                        }
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
                    </div>
                )}

                    </>
                )}
            </main>
        </div>
    )
}
