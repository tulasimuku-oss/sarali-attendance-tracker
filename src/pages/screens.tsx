import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import {
  assignStudentBatches,
  batchesOf,
  canUncancelEvent,
  formatStudentBatches,
  futureAttendanceWithStudent,
  MAX_STUDENT_CLASSES,
  monthISO,
  parseStudentBatchLabel,
  sharePlain,
  sixMonthsAgoISO,
  sixMonthsAgoMonth,
  studentBatches,
  studentInBatch,
  toLocalDateTime,
  uid,
  uniqueClassNames,
  type Attendance,
  type AttendanceStatus,
  type EventItem,
  type EventFile,
  type Fee,
  type FeeStatus,
  type Note,
  type Student,
  type StudioState,
} from "../lib/demo";
import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AbsentIcon,
  AudioIcon,
  BinIcon,
  CalendarIcon,
  CloseIcon,
  DownloadIcon,
  MicIcon,
  NotesIcon,
  PauseIcon,
  PencilIcon,
  PresentIcon,
  RemoteIcon,
  ShareIcon,
  StopIcon,
  StudentsIcon,
  UploadIcon,
} from "../components/Icons";
import { useTheme } from "../context/ThemeProvider";
import { APP_VERSION, DARK_MODE_AVAILABLE } from "../lib/theme";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function localDayISO(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function eventDayISO(startsAt: string) {
  return startsAt.slice(0, 10);
}

function calendarDayFromQuery(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

function monthCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function defaultEventStart(dayISO: string) {
  const [year, month, day] = dayISO.split("-").map(Number);
  const start = new Date(year, month - 1, day, 16, 0, 0, 0);
  if (dayISO === localDayISO()) {
    const now = new Date();
    start.setHours(now.getHours(), now.getMinutes(), 0, 0);
  }
  return toLocalDateTime(start);
}

function calendarDayHeading(dayISO: string, todayISOValue: string) {
  const date = new Date(`${dayISO}T00:00`);
  const monthDay = date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  if (dayISO === todayISOValue) return `Today, ${monthDay}`;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function readDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function AddSheet({
  titleId,
  title,
  onClose,
  stacked,
  children,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  stacked?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (stacked) event.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, stacked);
    return () => window.removeEventListener("keydown", onKey, stacked);
  }, [onClose, stacked]);

  return createPortal(
    <div
      className={`modal-backdrop${stacked ? " is-stacked" : ""}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="card stack modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3 id={titleId} style={{ margin: 0 }}>{title}</h3>
          <button
            type="button"
            className="icon-well modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon title="" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function ConfirmSheet({
  titleId,
  title,
  body,
  primaryLabel,
  primaryClass = "",
  altLabel,
  onPrimary,
  onAlt,
  onClose,
}: {
  titleId: string;
  title: string;
  body: string;
  primaryLabel: ReactNode;
  primaryClass?: string;
  altLabel?: string;
  onPrimary: () => void;
  onAlt?: () => void;
  onClose: () => void;
}) {
  return (
    <AddSheet titleId={titleId} title={title} onClose={onClose}>
      <p>{body}</p>
      <button type="button" className={`${primaryClass} icon-text-btn`.trim()} onClick={onPrimary}>{primaryLabel}</button>
      {altLabel && onAlt ? (
        <button type="button" className="secondary" onClick={onAlt}>{altLabel}</button>
      ) : null}
      <button type="button" className="secondary" onClick={onClose}>Keep event</button>
    </AddSheet>
  );
}

const FLASH_HOLD_MS = 10_000;
const FLASH_FADE_MS = 450;

function useFlashMessage() {
  const [message, setMessage] = useState("");
  const [fading, setFading] = useState(false);
  const holdRef = useRef(0);
  const fadeRef = useRef(0);

  useEffect(() => () => {
    window.clearTimeout(holdRef.current);
    window.clearTimeout(fadeRef.current);
  }, []);

  function flash(next: string) {
    window.clearTimeout(holdRef.current);
    window.clearTimeout(fadeRef.current);
    setFading(false);
    setMessage(next);
    holdRef.current = window.setTimeout(() => {
      setFading(true);
      fadeRef.current = window.setTimeout(() => {
        setMessage("");
        setFading(false);
      }, FLASH_FADE_MS);
    }, FLASH_HOLD_MS);
  }

  return { message, fading, flash };
}

function FlashAlert({
  message,
  fading,
  tone,
}: {
  message: string;
  fading: boolean;
  tone?: "error";
}) {
  if (!message) return null;
  return (
    <p
      className={`flash-alert${tone === "error" ? " is-error" : ""}${fading ? " is-fading" : ""}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

function lessonRoster(
  students: Student[],
  attendance: Attendance[],
  lessonDate: string,
  today: string
) {
  const isPast = lessonDate < today;
  const dayRows = attendance.filter((row) => row.lesson_date === lessonDate);
  const rowByStudent = new Map(dayRows.map((row) => [row.student_id, row]));
  const listed = new Set<string>();
  const roster: Array<{ id: string; name: string; batch: string; batches: string[]; active: boolean }> = [];

  for (const student of students) {
    listed.add(student.id);
    const row = rowByStudent.get(student.id);
    const freeze = Boolean(isPast && row && (row.student_name || row.student_batch));
    const batches = freeze && row?.student_batch
      ? parseStudentBatchLabel(row.student_batch)
      : studentBatches(student);
    roster.push({
      id: student.id,
      name: freeze && row?.student_name ? row.student_name : student.name,
      batch: batches.join(" · "),
      batches,
      active: true,
    });
  }

  for (const row of dayRows) {
    if (listed.has(row.student_id)) continue;
    const batches = parseStudentBatchLabel(row.student_batch || "");
    roster.push({
      id: row.student_id,
      name: row.student_name || "Removed student",
      batch: batches.join(" · "),
      batches,
      active: false,
    });
  }

  return roster.sort((a, b) => a.batch.localeCompare(b.batch) || a.name.localeCompare(b.name));
}

function isCountedAttendance(status?: AttendanceStatus) {
  return status === "present" || status === "remote" || status === "absent";
}

function attendanceOnDay(attendance: Attendance[], studentId: string, day: string) {
  return attendance.find((row) => row.student_id === studentId && row.lesson_date === day);
}

function studentsInBatch(students: Student[], batch: string) {
  return students.filter((student) => studentInBatch(student, batch));
}

function batchIsFullyMarked(students: Student[], attendance: Attendance[], batch: string, day: string) {
  const members = studentsInBatch(students, batch);
  return (
    members.length > 0 &&
    members.every((student) => isCountedAttendance(attendanceOnDay(attendance, student.id, day)?.status))
  );
}

function fullyMarkedBatches(students: Student[], attendance: Attendance[], day: string) {
  return batchesOf(students).filter((batch) => batchIsFullyMarked(students, attendance, batch, day));
}

function latestMarkScore(attendance: Attendance[], studentIds: Set<string>, day: string) {
  let score = -1;
  attendance.forEach((row, index) => {
    if (row.lesson_date !== day || !studentIds.has(row.student_id) || !isCountedAttendance(row.status)) return;
    const stamped = row.updated_at ? Date.parse(row.updated_at) : Number.NaN;
    const next = Number.isFinite(stamped) ? stamped : index;
    if (next >= score) score = next;
  });
  return score;
}

function homeChartBatch(students: Student[], attendance: Attendance[], day: string): string | "all" | null {
  const batches = batchesOf(students);
  const complete = fullyMarkedBatches(students, attendance, day);
  if (complete.length === 0) return null;
  if (complete.length === batches.length && batches.length > 1) return "all";
  if (complete.length === 1) return complete[0];
  return complete.reduce((winner, batch) => {
    const batchScore = latestMarkScore(
      attendance,
      new Set(studentsInBatch(students, batch).map((student) => student.id)),
      day
    );
    const winnerScore = latestMarkScore(
      attendance,
      new Set(studentsInBatch(students, winner).map((student) => student.id)),
      day
    );
    return batchScore >= winnerScore ? batch : winner;
  });
}

const ATTENDANCE_BATCH_KEY = "sarali.attendance.batches";

type AttendancePickState = {
  picked: string[] | "all";
  multi: boolean;
};

function loadAttendancePickState(): AttendancePickState {
  try {
    const raw = sessionStorage.getItem(ATTENDANCE_BATCH_KEY);
    if (!raw) return { picked: "all", multi: false };
    const parsed = JSON.parse(raw) as string[] | "all" | AttendancePickState;
    if (parsed === "all") return { picked: "all", multi: false };
    if (Array.isArray(parsed)) {
      const picked = parsed.filter((item) => typeof item === "string");
      return { picked, multi: picked.length > 1 };
    }
    if (parsed && (parsed.picked === "all" || Array.isArray(parsed.picked))) {
      const picked =
        parsed.picked === "all"
          ? "all"
          : parsed.picked.filter((item) => typeof item === "string");
      const multi = Boolean(parsed.multi) || (Array.isArray(picked) && picked.length > 1);
      return { picked, multi };
    }
  } catch {
    /* keep default */
  }
  return { picked: "all", multi: false };
}

function saveAttendancePickState(next: AttendancePickState) {
  try {
    sessionStorage.setItem(ATTENDANCE_BATCH_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

async function readEventFiles(files: File[]): Promise<EventFile[]> {
  const usable = files.filter((file) => file.size > 0).slice(0, 6);
  return Promise.all(usable.map(async (file) => ({
    name: file.name,
    mime: file.type || "application/octet-stream",
    dataUrl: await readDataUrl(file),
  })));
}

function normalizeHttpLink(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).href;
  } catch {
    return "";
  }
}

function isAllowedNoteMedia(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".docx") ||
    name.endsWith(".pdf") ||
    name.endsWith(".txt") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".gif")
  );
}

function isImageNoteFile(file: EventFile) {
  return file.mime.startsWith("image/") || /\.(jpe?g|png|gif)$/i.test(file.name);
}

function filesForNote(note: Note): EventFile[] {
  if (note.files?.length) return note.files;
  return (note.images ?? []).map((dataUrl, index) => ({
    name: `image-${index + 1}.jpg`,
    mime: "image/jpeg",
    dataUrl,
  }));
}

function eventStartInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return value.slice(0, 16);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return toLocalDateTime(date);
}

function AttendanceRing({
  present,
  remote,
  absent,
}: {
  present: number;
  remote: number;
  absent: number;
}) {
  const total = present + remote + absent;
  const radius = 15.915;
  const track = 100;
  let offset = 0;
  const slices = [
    { key: "present", value: present },
    { key: "remote", value: remote },
    { key: "absent", value: absent },
  ].filter((slice) => slice.value > 0);
  return (
    <svg className="home-donut" viewBox="0 0 36 36" aria-hidden="true">
      <circle
        className="home-donut-track"
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        strokeWidth="3.8"
      />
      {slices.map((slice) => {
        const length = (slice.value / Math.max(total, 1)) * track;
        const circle = (
          <circle
            key={slice.key}
            className={`att-hue ${slice.key}`}
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            strokeWidth="3.8"
            strokeDasharray={`${length} ${track - length}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 18 18)"
          />
        );
        offset += length;
        return circle;
      })}
    </svg>
  );
}

export function HomePage() {
  const { studio, setStudio } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [batch, setBatch] = useState("all");
  const [batchTouched, setBatchTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);
  if (!studio) return null;

  const today = localDayISO(now);
  const batches = batchesOf(studio.students);
  const autoBatch = homeChartBatch(studio.students, studio.attendance, today);
  const selected = batchTouched ? batch : (autoBatch ?? "all");
  const viewingAutoEmpty = !batchTouched && autoBatch === null;
  const visibleStudents = studio.students.filter(
    (student) => selected === "all" || studentInBatch(student, selected)
  );
  const visibleIds = new Set(visibleStudents.map((student) => student.id));
  const todayMarks = studio.attendance.filter(
    (row) => row.lesson_date === today && visibleIds.has(row.student_id)
  );
  const present = todayMarks.filter((row) => row.status === "present").length;
  const remote = todayMarks.filter((row) => row.status === "remote").length;
  const absent = todayMarks.filter((row) => row.status === "absent").length;
  const cancelled = todayMarks.filter((row) => row.status === "cancelled").length;
  const marked = present + remote + absent;
  const studioMarked = studio.students.filter((student) =>
    isCountedAttendance(attendanceOnDay(studio.attendance, student.id, today)?.status)
  ).length;
  const everyoneCancelled =
    visibleStudents.length > 0 &&
    visibleStudents.every(
      (student) => attendanceOnDay(studio.attendance, student.id, today)?.status === "cancelled"
    );
  const chartLabel = selected === "all" ? "All batches" : selected;
  const upcoming = [...studio.events]
    .filter((event) => event.status !== "cancelled" && new Date(event.starts_at).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 4);
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeLabel = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="stack">
      <section className="card home-now" aria-label="Current date and time">
        <p className="muted" style={{ margin: 0 }}>{dateLabel}</p>
        <h2 className="home-now-time">{timeLabel}</h2>
      </section>
      <section className="card stack" aria-label="Today's attendance">
        <div className="home-att-head">
          <h3>Today's attendance</h3>
          <label className="home-att-filter">
            Batch
            <select
              value={selected}
              aria-label="Filter attendance by batch"
              onChange={(event) => {
                setBatchTouched(true);
                setBatch(event.target.value);
              }}
            >
              <option value="all">All Batches</option>
              {batches.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        {everyoneCancelled ? (
          <p>{selected === "all" ? "Class cancelled today." : `Class cancelled today for ${selected}.`}</p>
        ) : viewingAutoEmpty ? (
          <p>No batch is fully marked yet. The chart appears once every student in a batch is marked Present, Remote, or Absent.</p>
        ) : cancelled > 0 && marked === 0 ? (
          <p>{selected === "all" ? "Class cancelled today." : `Class cancelled today for ${selected}.`}</p>
        ) : marked === 0 ? (
          <p>
            {selected === "all"
              ? "No attendance marked yet. Counts update as you mark Present, Remote, or Absent."
              : `No attendance marked yet for ${selected}. Counts update as you mark Present, Remote, or Absent.`}
          </p>
        ) : (
          <div
            className="home-att"
            role="img"
            aria-label={`${chartLabel}: ${present} present, ${remote} remote, ${absent} absent`}
          >
            <AttendanceRing present={present} remote={remote} absent={absent} />
            <ul className="home-att-legend">
              <li className="present">
                <PresentIcon title="" />
                <span>Present</span>
                <strong>{present}</strong>
              </li>
              <li className="remote">
                <RemoteIcon title="" />
                <span>Remote</span>
                <strong>{remote}</strong>
              </li>
              <li className="absent">
                <AbsentIcon title="" />
                <span>Absent</span>
                <strong>{absent}</strong>
              </li>
            </ul>
          </div>
        )}
        <p className="muted" style={{ margin: 0 }}>
          {viewingAutoEmpty
            ? `${studioMarked} of ${studio.students.length} students marked today.`
            : `${marked} of ${visibleStudents.length} students marked today.`}
        </p>
      </section>
      <section className="card stack section-card" aria-label="Alerts">
        <h3>Alerts</h3>
        {upcoming.length === 0 ? (
          <p>No upcoming events.</p>
        ) : (
          <ul className="home-alerts">
            {upcoming.map((event) => (
              <li key={event.id} className="home-alert-item">
                <Link className="home-alert" to={`/calendar?day=${eventDayISO(event.starts_at)}`}>
                  <span className="icon-well"><CalendarIcon title="" /></span>
                  <span>
                    <strong>{event.title}</strong>
                    <p>{formatWhen(event.starts_at)}</p>
                  </span>
                </Link>
                <button
                  type="button"
                  className="event-action event-action-label danger"
                  onClick={() => setDeleteTarget(event)}
                >
                  <BinIcon title="" />
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {deleteTarget ? (
        <ConfirmSheet
          titleId="home-event-delete-title"
          title="Delete this event?"
          body={`Are you sure you want to delete “${deleteTarget.title}”? This cannot be undone.`}
          primaryLabel={<><BinIcon title="" /> Delete</>}
          primaryClass="danger"
          onPrimary={() => {
            setStudio({
              ...studio,
              events: studio.events.filter((row) => row.id !== deleteTarget.id),
              deletedEventIds: [...new Set([...(studio.deletedEventIds ?? []), deleteTarget.id])],
            });
            setDeleteTarget(null);
          }}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
      <section className="tile-grid" aria-label="Studio tools">
        <Link className="card action-tile" to="/audio">
          <span className="icon-well"><AudioIcon title="" /></span>
          <span>Audio</span>
        </Link>
        <Link className="card action-tile" to="/students">
          <span className="icon-well"><StudentsIcon title="" /></span>
          <span>Students</span>
        </Link>
      </section>
    </div>
  );
}

export function StudentsPage() {
  const { studio, setStudio } = useAuth();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [classPicks, setClassPicks] = useState<string[]>([]);
  const [classDraft, setClassDraft] = useState("");
  const [classError, setClassError] = useState("");
  const [limitOpen, setLimitOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Student | null>(null);
  const { message, fading, flash } = useFlashMessage();
  const nameRef = useRef<HTMLInputElement>(null);
  const classRef = useRef<HTMLInputElement>(null);
  const sheetOpen = adding || editingId !== null;

  function closeSheet() {
    setAdding(false);
    setEditingId(null);
    setClassDraft("");
    setClassError("");
    setLimitOpen(false);
  }

  function openAdd() {
    setRestoring(false);
    setRemoveTarget(null);
    setEditingId(null);
    setClassPicks([]);
    setClassDraft("");
    setClassError("");
    setLimitOpen(false);
    setAdding(true);
  }

  function openEdit(student: Student) {
    setRestoring(false);
    setRemoveTarget(null);
    setAdding(false);
    setClassPicks(studentBatches(student));
    setClassDraft("");
    setClassError("");
    setLimitOpen(false);
    setEditingId(student.id);
  }

  useEffect(() => {
    if (!sheetOpen) return;
    nameRef.current?.focus();
  }, [sheetOpen, editingId]);

  if (!studio) return null;

  const editing = studio.students.find((student) => student.id === editingId) ?? null;
  const roster = [...studio.students].sort((a, b) =>
    formatStudentBatches(a).localeCompare(formatStudentBatches(b)) || a.name.localeCompare(b.name)
  );
  const deletedStudents = studio.deletedStudents ?? [];
  const knownClasses = uniqueClassNames([
    ...batchesOf(studio.students, studio.attendance),
    ...classPicks,
  ]);
  const suggestedClasses = knownClasses.filter(
    (name) => !classPicks.some((pick) => pick.toLowerCase() === name.toLowerCase())
  );

  function tryAddClass(name: string) {
    const next = name.trim();
    if (!next) return false;
    if (classPicks.some((pick) => pick.toLowerCase() === next.toLowerCase())) {
      setClassDraft("");
      setClassError("");
      return true;
    }
    if (classPicks.length >= MAX_STUDENT_CLASSES) {
      setLimitOpen(true);
      return false;
    }
    setClassPicks([...classPicks, next]);
    setClassDraft("");
    setClassError("");
    return true;
  }

  function collectClasses(): string[] | "limit" {
    const draft = classDraft.trim();
    if (!draft) return classPicks;
    if (classPicks.some((pick) => pick.toLowerCase() === draft.toLowerCase())) return classPicks;
    if (classPicks.length >= MAX_STUDENT_CLASSES) return "limit";
    return [...classPicks, draft];
  }

  function persistStudent(next: Student, students: Student[]) {
    const today = localDayISO();
    setStudio({
      ...studio,
      students,
      attendance: futureAttendanceWithStudent(studio.attendance, next.id, today, {
        student_name: next.name,
        student_batch: formatStudentBatches(next),
      }),
    });
  }

  function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const classes = collectClasses();
    if (classes === "limit") {
      setLimitOpen(true);
      return;
    }
    if (!classes.length) {
      setClassError("Add at least one class.");
      classRef.current?.focus();
      return;
    }
    const data = new FormData(event.currentTarget);
    const student = assignStudentBatches({
      id: uid(),
      name: String(data.get("name")),
      batch: "",
      rate_cents: Math.round(Number(data.get("rate") || 0) * 100),
    }, classes);
    persistStudent(student, [...studio.students, student]);
    flash("Student added.");
    closeSheet();
  }

  function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const classes = collectClasses();
    if (classes === "limit") {
      setLimitOpen(true);
      return;
    }
    if (!classes.length) {
      setClassError("Add at least one class.");
      classRef.current?.focus();
      return;
    }
    const data = new FormData(event.currentTarget);
    const next = assignStudentBatches({
      ...editing,
      name: String(data.get("name")),
      rate_cents: Math.round(Number(data.get("rate") || 0) * 100),
    }, classes);
    persistStudent(
      next,
      studio.students.map((student) => (student.id === editing.id ? next : student))
    );
    flash("Student updated.");
    closeSheet();
  }

  function dropFromRoster(student: Student) {
    setStudio({
      ...studio,
      students: studio.students.filter((item) => item.id !== student.id),
      deletedStudents: [
        student,
        ...deletedStudents.filter((item) => item.id !== student.id),
      ],
    });
    setRemoveTarget(null);
    if (editingId === student.id) closeSheet();
    flash("Student deleted.");
  }

  function removeFromOneClass(student: Student, className: string) {
    const remaining = studentBatches(student).filter((name) => name !== className);
    if (!remaining.length) {
      dropFromRoster(student);
      return;
    }
    const next = assignStudentBatches(student, remaining);
    persistStudent(
      next,
      studio.students.map((item) => (item.id === student.id ? next : item))
    );
    setRemoveTarget(null);
    if (editingId === student.id) setClassPicks(remaining);
    flash(`${student.name} removed from ${className}.`);
  }

  function restoreStudent(student: Student) {
    const remaining = deletedStudents.filter((item) => item.id !== student.id);
    setStudio({
      ...studio,
      students: studio.students.some((item) => item.id === student.id)
        ? studio.students
        : [...studio.students, student],
      deletedStudents: remaining,
    });
    if (remaining.length === 0) setRestoring(false);
    flash(`${student.name} restored.`);
  }

  const removeClasses = removeTarget ? studentBatches(removeTarget) : [];

  return (
    <div className="stack page-with-add">
      <h2>Students</h2>
      <button
        className="secondary add-sheet-btn container-btn"
        type="button"
        onClick={openAdd}
      >
        Add student
      </button>
      {deletedStudents.length ? (
        <button
          className="secondary add-sheet-btn"
          type="button"
          onClick={() => {
            closeSheet();
            setRemoveTarget(null);
            setRestoring(true);
          }}
        >
          Restore deleted
        </button>
      ) : null}
      <FlashAlert message={message} fading={fading} />
      {roster.length === 0 ? (
        <p className="card empty-alert">No students yet.</p>
      ) : (
        <ul className="card roster roster-card">
          {roster.map((student) => (
            <li key={student.id}>
              <div className="roster-info">
                <strong>{student.name}</strong>
                <span className="roster-batch">{formatStudentBatches(student) || "No class"}</span>
              </div>
              <div className="roster-actions">
                <button
                  type="button"
                  className="mark-btn"
                  onClick={() => openEdit(student)}
                >
                  Edit
                </button>
                <button type="button" className="mark-btn icon-text-btn" onClick={() => setRemoveTarget(student)}>
                  <BinIcon title="" />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {sheetOpen ? (
        <AddSheet
          titleId="student-sheet-title"
          title={editing ? "Edit student" : "Add student"}
          onClose={closeSheet}
        >
          <form className="stack" onSubmit={editing ? saveStudent : addStudent} key={editingId ?? "new"}>
            <label>Name <input ref={nameRef} name="name" required defaultValue={editing?.name ?? ""} /></label>
            <div className="class-field">
              <span>Classes</span>
              <p className="muted class-hint">A student can be in up to 2 classes.</p>
              {classPicks.length ? (
                <ul className="class-picks">
                  {classPicks.map((name) => (
                    <li key={name} className="class-pick">
                      <span>{name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${name}`}
                        onClick={() => {
                          setClassPicks(classPicks.filter((item) => item !== name));
                          setClassError("");
                        }}
                      >
                        <CloseIcon title="" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="class-add-row">
                <input
                  ref={classRef}
                  value={classDraft}
                  list="student-class-options"
                  placeholder="Class name"
                  aria-label="Class name"
                  onChange={(event) => {
                    setClassDraft(event.target.value);
                    setClassError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    tryAddClass(classDraft);
                  }}
                />
                <button type="button" className="secondary" onClick={() => tryAddClass(classDraft)}>
                  Add class
                </button>
              </div>
              <datalist id="student-class-options">
                {suggestedClasses.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {suggestedClasses.length ? (
                <div className="class-suggestions" role="group" aria-label="Existing classes">
                  {suggestedClasses.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="batch-chip"
                      onClick={() => tryAddClass(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
              {classError ? <p className="error" role="alert">{classError}</p> : null}
            </div>
            <label>
              Lesson rate (INR)
              <input
                name="rate"
                type="number"
                min="0"
                step="50"
                defaultValue={editing ? String(editing.rate_cents / 100) : ""}
              />
            </label>
            <button className="forest" type="submit">{editing ? "Save" : "Add student"}</button>
          </form>
        </AddSheet>
      ) : null}
      {restoring ? (
        <AddSheet
          titleId="restore-students-title"
          title="Restore deleted"
          onClose={() => setRestoring(false)}
        >
          <ul className="roster">
            {deletedStudents.map((student) => (
              <li key={student.id}>
                <div className="roster-info">
                  <strong>{student.name}</strong>
                  <span className="roster-batch">{formatStudentBatches(student) || "No class"}</span>
                </div>
                <div className="roster-actions">
                  <button type="button" className="mark-btn" onClick={() => restoreStudent(student)}>
                    Restore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </AddSheet>
      ) : null}
      {limitOpen ? (
        <AddSheet
          titleId="class-limit-title"
          title="Only 2 classes"
          stacked
          onClose={() => setLimitOpen(false)}
        >
          <p>You can choose only 2 classes for a student.</p>
          <button type="button" className="forest" onClick={() => setLimitOpen(false)}>OK</button>
        </AddSheet>
      ) : null}
      {removeTarget ? (
        <AddSheet
          titleId="remove-student-title"
          title={`Remove ${removeTarget.name}?`}
          stacked
          onClose={() => setRemoveTarget(null)}
        >
          {removeClasses.length > 1 ? (
            <>
              <p>Remove them from one class, or from both.</p>
              {removeClasses.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="secondary"
                  onClick={() => removeFromOneClass(removeTarget, name)}
                >
                  Remove from {name}
                </button>
              ))}
              <button type="button" className="danger" onClick={() => dropFromRoster(removeTarget)}>
                Remove from both classes
              </button>
            </>
          ) : (
            <>
              <p>
                {removeClasses[0]
                  ? `Remove ${removeTarget.name} from ${removeClasses[0]}? Past attendance stays as it was.`
                  : `Remove ${removeTarget.name} from the roster? Past attendance stays as it was.`}
              </p>
              <button type="button" className="danger" onClick={() => dropFromRoster(removeTarget)}>
                Remove
              </button>
            </>
          )}
          <button type="button" className="secondary" onClick={() => setRemoveTarget(null)}>
            Cancel
          </button>
        </AddSheet>
      ) : null}
    </div>
  );
}

export function AttendancePage() {
  const { studio, setStudio } = useAuth();
  const [lessonDate, setLessonDate] = useState(() => localDayISO());
  const [pickedBatches, setPickedBatches] = useState<string[] | "all">(() => loadAttendancePickState().picked);
  const [multiBatches, setMultiBatches] = useState(() => loadAttendancePickState().multi);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    saveAttendancePickState({ picked: pickedBatches, multi: multiBatches });
  }, [pickedBatches, multiBatches]);
  if (!studio) return null;

  const today = localDayISO();
  const batches = batchesOf(studio.students, studio.attendance);
  const activePicks = pickedBatches === "all"
    ? "all"
    : pickedBatches.filter((name) => batches.includes(name));
  const allBatches = activePicks === "all";
  const noneSelected = !allBatches && activePicks.length === 0;
  const roster = lessonRoster(studio.students, studio.attendance, lessonDate, today);
  const visible = allBatches
    ? roster
    : roster.filter((student) => student.batches.some((name) => activePicks.includes(name)));
  const minDate = sixMonthsAgoISO();
  const maxDate = today;

  function recordFor(studentId: string) {
    return studio.attendance.find(
      (row) => row.student_id === studentId && row.lesson_date === lessonDate
    );
  }

  function statusFor(studentId: string): AttendanceStatus | "" {
    return recordFor(studentId)?.status ?? "";
  }

  function noteKey(studentId: string) {
    return `${studentId}:${lessonDate}`;
  }

  function noteFor(studentId: string) {
    const key = noteKey(studentId);
    if (Object.prototype.hasOwnProperty.call(noteDrafts, key)) return noteDrafts[key];
    return recordFor(studentId)?.note ?? "";
  }

  function snapshotFor(studentId: string, existing?: Attendance) {
    const isPast = lessonDate < today;
    const live = studio.students.find((student) => student.id === studentId);
    if (isPast && existing?.student_name) {
      return {
        student_name: existing.student_name,
        student_batch: existing.student_batch ?? (live ? formatStudentBatches(live) : ""),
      };
    }
    if (live) return { student_name: live.name, student_batch: formatStudentBatches(live) };
    return {
      student_name: existing?.student_name || "Removed student",
      student_batch: existing?.student_batch || "",
    };
  }

  function upsertRow(studentId: string, patch: Partial<Attendance>) {
    const existing = recordFor(studentId);
    const rest = studio.attendance.filter(
      (row) => !(row.student_id === studentId && row.lesson_date === lessonDate)
    );
    const next: Attendance = {
      id: existing?.id ?? uid(),
      student_id: studentId,
      lesson_date: lessonDate,
      status: existing?.status ?? "present",
      note: existing?.note,
      ...patch,
      ...snapshotFor(studentId, existing),
      updated_at: new Date().toISOString(),
    };
    setStudio({ ...studio, attendance: [...rest, next] });
  }

  function mark(studentId: string, status: AttendanceStatus) {
    if (statusFor(studentId) === "cancelled") return;
    const note = noteFor(studentId).trim();
    const keepNote = (status === "remote" || status === "absent") && note;
    upsertRow(studentId, { status, note: keepNote ? noteFor(studentId) : undefined });
  }

  function saveNote(studentId: string, note: string) {
    setNoteDrafts((drafts) => ({ ...drafts, [noteKey(studentId)]: note }));
    if (!recordFor(studentId)) return;
    upsertRow(studentId, { note: note.trim() ? note : undefined });
  }

  const batchCancelled =
    visible.length > 0 && visible.every((student) => statusFor(student.id) === "cancelled");
  const showMultiToggle =
    batches.length > 1 &&
    !allBatches &&
    !noneSelected &&
    (activePicks.length === 1 || multiBatches || activePicks.length > 1);

  function selectAllBatches() {
    setMultiBatches(false);
    setPickedBatches(allBatches ? [] : "all");
  }

  function toggleBatch(name: string) {
    if (allBatches || noneSelected || !multiBatches) {
      setPickedBatches([name]);
      setMultiBatches(false);
      return;
    }
    const current = activePicks;
    const next = current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name];
    if (next.length > 0 && batches.every((batch) => next.includes(batch))) {
      setPickedBatches("all");
      setMultiBatches(false);
      return;
    }
    setPickedBatches(next);
  }

  function toggleMultiBatches(checked: boolean) {
    if (!checked && activePicks !== "all" && activePicks.length > 1) {
      setPickedBatches([activePicks[0]]);
    }
    setMultiBatches(checked);
  }

  function cancelBatch() {
    const label = allBatches ? "every batch" : activePicks.join(", ");
    if (!window.confirm(`Cancel class for ${label} on ${lessonDate}?`)) return;
    const ids = new Set(visible.map((student) => student.id));
    const rest = studio.attendance.filter(
      (row) => !(ids.has(row.student_id) && row.lesson_date === lessonDate)
    );
    const cancelled = visible.map((student) => {
      const existing = recordFor(student.id);
      return {
        id: existing?.id ?? uid(),
        student_id: student.id,
        lesson_date: lessonDate,
        status: "cancelled" as const,
        note: noteFor(student.id).trim() || undefined,
        ...snapshotFor(student.id, existing),
      };
    });
    setStudio({ ...studio, attendance: [...rest, ...cancelled] });
  }

  function restoreBatch() {
    const ids = new Set(visible.map((student) => student.id));
    setStudio({
      ...studio,
      attendance: studio.attendance.filter(
        (row) => !(ids.has(row.student_id) && row.lesson_date === lessonDate && row.status === "cancelled")
      ),
    });
  }

  return (
    <div className="stack">
      <h2>Attendance</h2>
      <section className="card stack">
        <label>Class date
          <input
            type="date"
            min={minDate}
            max={maxDate}
            value={lessonDate}
            onChange={(event) => setLessonDate(event.target.value)}
          />
        </label>
        <div className="batch-picks" role="group" aria-label="Batch">
          <span className="batch-picks-label">Batch</span>
          <button
            type="button"
            className="batch-chip"
            aria-pressed={allBatches}
            onClick={selectAllBatches}
          >
            All batches
          </button>
          {batches.map((name) => (
            <button
              type="button"
              className="batch-chip"
              key={name}
              aria-pressed={!allBatches && activePicks.includes(name)}
              onClick={() => toggleBatch(name)}
            >
              {name}
            </button>
          ))}
          {showMultiToggle ? (
            <label className="batch-multi">
              <input
                type="checkbox"
                checked={multiBatches || (!allBatches && activePicks.length > 1)}
                onChange={(event) => toggleMultiBatches(event.target.checked)}
              />
              Select multiple batches
            </label>
          ) : null}
        </div>
        <p>Open any class from the last 6 months, then tap to mark each student.</p>
        {noneSelected ? null : (
          <button
            className="secondary"
            type="button"
            onClick={batchCancelled ? restoreBatch : cancelBatch}
          >
            {batchCancelled ? "Restore Class" : allBatches ? "Cancel class for every batch" : "Cancel class for selected batches"}
          </button>
        )}
      </section>
      {noneSelected ? (
        <p className="card empty-alert" role="status">No batch has been selected.</p>
      ) : (
      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visible.map((student) => {
          const current = statusFor(student.id);
          const markersLocked = current === "cancelled";
          const note = noteFor(student.id);
          const noteActive = current === "remote" || current === "absent";
          return (
            <li key={student.id} className="card stack">
              <div className="att-student-head">
                <div>
                  <strong>{student.name}</strong>
                  <p>
                    {student.batch || "Batch not set"}
                    {student.active ? "" : " · Removed"}
                  </p>
                </div>
                {noteActive ? (
                  <label className="att-note">
                    <NotesIcon title="" />
                    <input
                      className="att-note-input"
                      value={note}
                      placeholder="Add note"
                      maxLength={140}
                      aria-label={`Note for ${student.name}`}
                      onChange={(event) => saveNote(student.id, event.target.value)}
                    />
                  </label>
                ) : null}
              </div>
              <div className="mark-row" role="group" aria-label={`Attendance for ${student.name}`}>
                <button
                  type="button"
                  className="mark-btn att-mark att-hue present"
                  aria-pressed={current === "present"}
                  disabled={markersLocked}
                  onClick={() => mark(student.id, "present")}
                >
                  <PresentIcon title="" />
                  Present
                </button>
                <button
                  type="button"
                  className="mark-btn att-mark att-hue remote"
                  aria-pressed={current === "remote"}
                  disabled={markersLocked}
                  onClick={() => mark(student.id, "remote")}
                >
                  <RemoteIcon title="" />
                  Remote
                </button>
                <button
                  type="button"
                  className="mark-btn att-mark att-hue absent"
                  aria-pressed={current === "absent"}
                  disabled={markersLocked}
                  onClick={() => mark(student.id, "absent")}
                >
                  <AbsentIcon title="" />
                  Absent
                </button>
              </div>
              {current === "cancelled" ? <p role="status">Class cancelled</p> : null}
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}

export function FeesPage() {
  const { studio, setStudio } = useAuth();
  const [period, setPeriod] = useState(monthISO());
  const [batch, setBatch] = useState("all");
  if (!studio) return null;

  const batches = batchesOf(studio.students);
  const visible = studio.students.filter((student) => batch === "all" || studentInBatch(student, batch));
  const today = localDayISO();
  const minPaidOn = sixMonthsAgoISO();

  function feeFor(studentId: string) {
    return studio.fees.find(
      (row) => row.student_id === studentId && (row.period || row.paid_on?.slice(0, 7)) === period
    );
  }

  function upsertFee(studentId: string, patch: Partial<Fee>) {
    const existing = feeFor(studentId);
    const rest = studio.fees.filter(
      (row) => !(row.student_id === studentId && (row.period || row.paid_on?.slice(0, 7)) === period)
    );
    const next: Fee = {
      id: existing?.id ?? uid(),
      student_id: studentId,
      period,
      status: existing?.status ?? "pending",
      paid_on: existing?.paid_on,
      upi_screenshot: existing?.upi_screenshot,
      ...patch,
    };
    setStudio({ ...studio, fees: [...rest, next] });
  }

  function mark(studentId: string, status: FeeStatus) {
    upsertFee(studentId, {
      status,
      paid_on: status === "paid" ? feeFor(studentId)?.paid_on || today : feeFor(studentId)?.paid_on,
    });
  }

  async function saveUpiShot(studentId: string, file: File | undefined) {
    if (!file || !file.type.startsWith("image/") || file.size === 0) return;
    upsertFee(studentId, {
      status: "paid",
      paid_on: feeFor(studentId)?.paid_on || today,
      upi_screenshot: {
        name: file.name,
        mime: file.type,
        dataUrl: await readDataUrl(file),
      },
    });
  }

  return (
    <div className="stack">
      <h2>Fees</h2>
      <section className="card stack">
        <label>Month
          <input
            type="month"
            min={sixMonthsAgoMonth()}
            max={monthISO()}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          />
        </label>
        <label>Batch
          <select value={batch} onChange={(event) => setBatch(event.target.value)}>
            <option value="all">All batches</option>
            {batches.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <p>Review paid and pending fees for any month in the last 6 months.</p>
      </section>
      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visible.map((student) => {
          const fee = feeFor(student.id);
          const current = fee?.status ?? "pending";
          return (
            <li key={student.id} className="card stack">
              <div>
                <strong>{student.name}</strong>
                <p>{formatStudentBatches(student) || "No class"}</p>
              </div>
              <div className="mark-row two" role="group" aria-label={`Fee status for ${student.name}`}>
                <button
                  type="button"
                  className="mark-btn"
                  aria-pressed={current === "paid"}
                  onClick={() => mark(student.id, "paid")}
                >
                  Paid
                </button>
                <button
                  type="button"
                  className="mark-btn"
                  aria-pressed={current === "pending"}
                  onClick={() => mark(student.id, "pending")}
                >
                  Pending
                </button>
              </div>
              {current === "paid" ? (
                <div className="fee-paid-extras">
                  <label className="fee-paid-date">
                    Paid on
                    <span className="fee-paid-date-row">
                      <CalendarIcon title="" />
                      <input
                        type="date"
                        min={minPaidOn}
                        max={today}
                        value={fee?.paid_on?.slice(0, 10) || today}
                        aria-label={`Date ${student.name} paid`}
                        onChange={(event) => upsertFee(student.id, {
                          status: "paid",
                          paid_on: event.target.value,
                        })}
                      />
                    </span>
                  </label>
                  <label className="fee-upi">
                    UPI screenshot
                    <input
                      type="file"
                      accept="image/*"
                      aria-label={`UPI screenshot for ${student.name}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        void saveUpiShot(student.id, file);
                      }}
                    />
                  </label>
                  {fee?.upi_screenshot ? (
                    <figure className="fee-upi-shot">
                      <img
                        src={fee.upi_screenshot.dataUrl}
                        alt={`UPI receipt for ${student.name}`}
                      />
                      <button
                        type="button"
                        className="mark-btn"
                        onClick={() => upsertFee(student.id, { upi_screenshot: undefined })}
                      >
                        Remove screenshot
                      </button>
                    </figure>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CalendarPage() {
  const { studio, setStudio } = useAuth();
  const [searchParams] = useSearchParams();
  const today = localDayISO();
  const requestedDay = calendarDayFromQuery(searchParams.get("day"));
  const [cursor, setCursor] = useState(() => {
    const iso = requestedDay ?? today;
    const date = new Date(`${iso}T00:00`);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(requestedDay ?? today);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ kind: "delete" | "cancel"; item: EventItem } | null>(null);
  const { message, fading, flash: setMessage } = useFlashMessage();
  const titleRef = useRef<HTMLInputElement>(null);
  const sheetOpen = adding || editingId !== null;

  useEffect(() => {
    if (!sheetOpen) return;
    titleRef.current?.focus();
  }, [sheetOpen, editingId]);

  useEffect(() => {
    if (!requestedDay) return;
    const date = new Date(`${requestedDay}T00:00`);
    setSelectedDay(requestedDay);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }, [requestedDay]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const item of studio?.events ?? []) {
      const key = eventDayISO(item.starts_at);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }
    return map;
  }, [studio?.events]);

  const otherEvents = useMemo(() => {
    return [...(studio?.events ?? [])]
      .filter((item) => eventDayISO(item.starts_at) !== selectedDay)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [studio?.events, selectedDay]);

  if (!studio) return null;

  const editing = studio.events.find((item) => item.id === editingId) ?? null;
  const cells = monthCells(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedInMonth = selectedDay.startsWith(
    `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`
  );
  const dayEvents = selectedInMonth ? (eventsByDay.get(selectedDay) ?? []) : [];

  function shiftMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    const year = next.getFullYear();
    const month = next.getMonth();
    setCursor({ year, month });
    const padded = `${year}-${String(month + 1).padStart(2, "0")}`;
    if (today.startsWith(padded)) setSelectedDay(today);
    else setSelectedDay(`${padded}-01`);
  }

  function closeSheet() {
    setAdding(false);
    setEditingId(null);
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    const uploaded = await readEventFiles(files);
    const title = String(data.get("title"));
    const starts_at = String(data.get("starts_at"));
    const notes = String(data.get("notes"));
    const batch = String(data.get("batch") || "");
    if (editing) {
      const nextFiles = [...(editing.files ?? []), ...uploaded].slice(0, 6);
      setStudio({
        ...studio,
        events: studio.events.map((row) =>
          row.id === editing.id
            ? { ...row, title, starts_at, notes, batch, files: nextFiles }
            : row
        ),
      });
      setMessage("Event updated.");
    } else {
      const next: EventItem = {
        id: uid(),
        title,
        starts_at,
        notes,
        status: "scheduled",
        batch,
        files: uploaded,
      };
      setStudio({ ...studio, events: [...studio.events, next] });
      setMessage("Event added.");
    }
    setSelectedDay(eventDayISO(starts_at));
    const start = new Date(starts_at);
    if (!Number.isNaN(start.getTime())) {
      setCursor({ year: start.getFullYear(), month: start.getMonth() });
    }
    closeSheet();
  }

  function removeEventFile(eventId: string, index: number) {
    setStudio({
      ...studio,
      events: studio.events.map((row) =>
        row.id === eventId
          ? { ...row, files: (row.files ?? []).filter((_, item) => item !== index) }
          : row
      ),
    });
  }

  function applyCancel(item: EventItem) {
    setStudio({
      ...studio,
      events: studio.events.map((row) =>
        row.id === item.id
          ? { ...row, status: "cancelled", cancelled_at: new Date().toISOString() }
          : row
      ),
    });
    setMessage("Event cancelled.");
  }

  function restoreEvent(item: EventItem) {
    if (!canUncancelEvent(item)) {
      setMessage("This event can no longer be un-cancelled.");
      return;
    }
    setStudio({
      ...studio,
      events: studio.events.map((row) =>
        row.id === item.id ? { ...row, status: "scheduled", cancelled_at: undefined } : row
      ),
    });
    setMessage("Event restored.");
  }

  function applyDelete(item: EventItem) {
    const deletedEventIds = [...new Set([...(studio.deletedEventIds ?? []), item.id])];
    setStudio({
      ...studio,
      events: studio.events.filter((row) => row.id !== item.id),
      deletedEventIds,
    });
    if (editingId === item.id) closeSheet();
    setPrompt(null);
    setMessage("Event deleted.");
  }

  async function shareEvent(item: EventItem) {
    const result = await sharePlain(
      item.title,
      `${formatWhen(item.starts_at)}\n${item.notes || "Studio event"}${item.status === "cancelled" ? "\nStatus: cancelled" : ""}`
    );
    if (result === "copied") setMessage("Event copied to clipboard.");
    if (result === "shared") setMessage("Event shared.");
  }

  return (
    <div className="stack cal-page">
      <h2>Calendar</h2>
      <button
        className="secondary cal-add-btn container-btn"
        type="button"
        onClick={() => {
          setEditingId(null);
          setAdding(true);
        }}
      >
        New event
      </button>
      <section className="card stack" aria-label="Month calendar">
        <div className="month-cal-head">
          <button
            type="button"
            className="mark-btn month-cal-nav"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            ‹
          </button>
          <h3>{monthLabel}</h3>
          <button
            type="button"
            className="mark-btn month-cal-nav"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            ›
          </button>
        </div>
        <div className="month-cal-weekdays" aria-hidden="true">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="month-cal-grid" role="grid" aria-label={monthLabel}>
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="month-cal-day is-empty" aria-hidden="true" />;
            }
            const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayItems = eventsByDay.get(iso) ?? [];
            const selected = iso === selectedDay;
            return (
              <button
                key={iso}
                type="button"
                className={`month-cal-day${iso === today ? " is-today" : ""}`}
                role="gridcell"
                aria-pressed={selected}
                aria-current={iso === today ? "date" : undefined}
                aria-label={`${new Date(cursor.year, cursor.month, day).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}${dayItems.length ? `, ${dayItems.length} event${dayItems.length === 1 ? "" : "s"}` : ""}`}
                onClick={() => setSelectedDay(iso)}
              >
                <span>{day}</span>
                <span className="month-cal-dots">
                  {dayItems.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={`month-cal-dot${item.status === "cancelled" ? " cancelled" : ""}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <FlashAlert message={message} fading={fading} />
      <section className="stack" aria-label="Events on selected day">
        <h3 className="cal-day-heading">
          {calendarDayHeading(selectedDay, today)}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="card empty-alert">No events on this day.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {dayEvents.map((item) => (
              <li key={item.id} className={`card stack${item.status === "cancelled" ? " event-cancelled" : ""}`}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{formatWhen(item.starts_at)}</p>
                  </div>
                  <span className={`status ${item.status === "cancelled" ? "cancelled" : "present"}`}>
                    {item.status === "cancelled" ? "Cancelled" : "Scheduled"}
                  </span>
                </div>
                {item.notes ? <p>{item.notes}</p> : null}
                {item.files?.length ? (
                  <ul className="event-files">
                    {item.files.map((file, index) => (
                      <li key={`${item.id}-${index}`}>
                        {file.mime.startsWith("image/") ? (
                          <a href={file.dataUrl} download={file.name}>
                            <img src={file.dataUrl} alt={file.name} />
                          </a>
                        ) : (
                          <a href={file.dataUrl} download={file.name}>{file.name}</a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="event-actions" role="group" aria-label={`Actions for ${item.title}`}>
                  <button type="button" className="event-action" aria-label="Share" onClick={() => shareEvent(item)}>
                    <ShareIcon title="" />
                  </button>
                  <button
                    type="button"
                    className="event-action"
                    aria-label="Edit"
                    onClick={() => {
                      setPrompt(null);
                      setAdding(false);
                      setEditingId(item.id);
                    }}
                  >
                    <PencilIcon title="" />
                  </button>
                  {item.status === "cancelled" ? (
                    <button
                      type="button"
                      className="event-action event-action-label"
                      disabled={!canUncancelEvent(item)}
                      onClick={() => restoreEvent(item)}
                    >
                      {canUncancelEvent(item) ? "Restore" : "Restore closed"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="event-action event-action-label"
                      onClick={() => setPrompt({ kind: "cancel", item })}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    className="event-action event-action-label danger"
                    onClick={() => setPrompt({ kind: "delete", item })}
                  >
                    <BinIcon title="" />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {otherEvents.length ? (
        <section className="stack" aria-label="Other events">
          <h3 className="cal-day-heading">Other events</h3>
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {otherEvents.map((item) => (
              <li key={item.id} className={`card stack${item.status === "cancelled" ? " event-cancelled" : ""}`}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{formatWhen(item.starts_at)}</p>
                  </div>
                  <span className={`status ${item.status === "cancelled" ? "cancelled" : "present"}`}>
                    {item.status === "cancelled" ? "Cancelled" : "Scheduled"}
                  </span>
                </div>
                {item.notes ? <p>{item.notes}</p> : null}
                <div className="event-actions" role="group" aria-label={`Actions for ${item.title}`}>
                  <button type="button" className="event-action" aria-label="Share" onClick={() => shareEvent(item)}>
                    <ShareIcon title="" />
                  </button>
                  <button
                    type="button"
                    className="event-action"
                    aria-label="Edit"
                    onClick={() => {
                      setPrompt(null);
                      setAdding(false);
                      setEditingId(item.id);
                    }}
                  >
                    <PencilIcon title="" />
                  </button>
                  {item.status === "cancelled" ? (
                    <button
                      type="button"
                      className="event-action event-action-label"
                      disabled={!canUncancelEvent(item)}
                      onClick={() => restoreEvent(item)}
                    >
                      {canUncancelEvent(item) ? "Restore" : "Restore closed"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="event-action event-action-label"
                      onClick={() => setPrompt({ kind: "cancel", item })}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    className="event-action event-action-label danger"
                    onClick={() => setPrompt({ kind: "delete", item })}
                  >
                    <BinIcon title="" />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sheetOpen && !prompt ? (
        <AddSheet
          titleId="event-sheet-title"
          title={editing ? "Edit event" : "New event"}
          onClose={closeSheet}
        >
          <form className="stack" onSubmit={saveEvent} key={editingId ?? "new"}>
            <label>Title <input ref={titleRef} name="title" required defaultValue={editing?.title ?? ""} placeholder="Beginner Vocal" /></label>
            <label>Starts
              <input
                name="starts_at"
                type="datetime-local"
                required
                defaultValue={editing ? eventStartInput(editing.starts_at) : defaultEventStart(selectedDay)}
              />
            </label>
            <label>Batch
              <select name="batch" defaultValue={editing?.batch ?? ""}>
                <option value="">No batch</option>
                {batchesOf(studio.students).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>Notes <textarea name="notes" defaultValue={editing?.notes ?? ""} /></label>
            {editing?.files?.length ? (
              <ul className="event-files">
                {editing.files.map((file, index) => (
                  <li key={`${editing.id}-${index}`} className="event-file">
                    {file.mime.startsWith("image/") ? (
                      <img src={file.dataUrl} alt={file.name} />
                    ) : (
                      <a href={file.dataUrl} download={file.name}>{file.name}</a>
                    )}
                    <button type="button" className="mark-btn" onClick={() => removeEventFile(editing.id, index)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label>Files
              <input name="files" type="file" multiple />
            </label>
            <button className="forest" type="submit">{editing ? "Save event" : "Add event"}</button>
          </form>
        </AddSheet>
      ) : null}
      {prompt?.kind === "delete" ? (
        <ConfirmSheet
          titleId="event-delete-title"
          title="Delete this event?"
          body={`Are you sure you want to delete “${prompt.item.title}”? This cannot be undone.`}
          primaryLabel={<><BinIcon title="" /> Delete</>}
          primaryClass="danger"
          onPrimary={() => applyDelete(prompt.item)}
          onClose={() => setPrompt(null)}
        />
      ) : null}
      {prompt?.kind === "cancel" ? (
        <ConfirmSheet
          titleId="event-cancel-title"
          title="Cancel this event?"
          body={`Are you sure you want to cancel “${prompt.item.title}”? You can restore it for up to 2 weeks.`}
          primaryLabel="Cancel event"
          altLabel="Reschedule instead"
          onPrimary={() => {
            applyCancel(prompt.item);
            setPrompt(null);
          }}
          onAlt={() => {
            setPrompt(null);
            setAdding(false);
            setEditingId(prompt.item.id);
          }}
          onClose={() => setPrompt(null)}
        />
      ) : null}
    </div>
  );
}

export function NotesPage() {
  const { studio, setStudio } = useAuth();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [saveError, setSaveError] = useState("");
  const { message, fading, flash: setMessage } = useFlashMessage();
  const titleRef = useRef<HTMLInputElement>(null);
  const sheetOpen = adding || editingId !== null;
  const noteReady = title.trim().length > 0 && body.trim().length >= 10;

  function closeSheet() {
    setAdding(false);
    setEditingId(null);
    setTitle("");
    setBody("");
    setLinkDraft("");
    setSaveError("");
  }

  useEffect(() => {
    if (!sheetOpen) return;
    titleRef.current?.focus();
  }, [sheetOpen, editingId]);

  if (!studio) return null;

  const editing = studio.notes.find((note) => note.id === editingId) ?? null;

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteReady) {
      setSaveError(
        !title.trim() ? "Enter a title." : "Write at least 10 characters in the note."
      );
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    const picked = data.getAll("media").filter((item): item is File => item instanceof File && item.size > 0);
    if (picked.some((file) => !isAllowedNoteMedia(file))) {
      setSaveError("Please choose .docx, .pdf, .txt, .jpg, .png, or .gif files.");
      return;
    }
    const linkRaw = linkDraft.trim();
    const link = normalizeHttpLink(linkRaw);
    if (linkRaw && !link) {
      setSaveError("Enter a valid link.");
      return;
    }
    const uploaded = await readEventFiles(picked.filter(isAllowedNoteMedia));
    const nextTitle = title.trim();
    const nextBody = body.trim();
    const existingFiles = editing ? filesForNote(editing) : [];
    const files = [...existingFiles, ...uploaded].slice(0, 6);
    const images = files.filter(isImageNoteFile).map((file) => file.dataUrl);
    const links = [...(editing?.links ?? [])];
    if (link && !links.includes(link)) links.push(link);

    if (editing) {
      setStudio({
        ...studio,
        notes: studio.notes.map((note) =>
          note.id === editing.id
            ? { ...note, title: nextTitle, body: nextBody, images, files, links }
            : note
        ),
      });
      setMessage("Note updated.");
    } else {
      const note: Note = { id: uid(), title: nextTitle, body: nextBody, images, files, links };
      setStudio({ ...studio, notes: [note, ...studio.notes] });
      setMessage("Note saved.");
    }
    closeSheet();
  }

  function patchNote(noteId: string, next: Partial<Note>) {
    setStudio({
      ...studio,
      notes: studio.notes.map((note) => (note.id === noteId ? { ...note, ...next } : note)),
    });
  }

  function removeFile(noteId: string, index: number) {
    const note = studio.notes.find((item) => item.id === noteId);
    if (!note) return;
    const files = filesForNote(note).filter((_, item) => item !== index);
    patchNote(noteId, {
      files,
      images: files.filter(isImageNoteFile).map((file) => file.dataUrl),
    });
  }

  function removeLink(noteId: string, index: number) {
    const note = studio.notes.find((item) => item.id === noteId);
    if (!note) return;
    patchNote(noteId, { links: (note.links ?? []).filter((_, item) => item !== index) });
  }

  function deleteNote(note: Note) {
    if (!window.confirm(`Delete “${note.title}”?`)) return;
    setStudio({ ...studio, notes: studio.notes.filter((item) => item.id !== note.id) });
    if (editingId === note.id) closeSheet();
    setMessage("Note deleted.");
  }

  async function shareNote(note: Note) {
    const files = filesForNote(note);
    const extra = [
      files.length ? `${files.length} file${files.length === 1 ? "" : "s"} attached.` : "",
      ...(note.links ?? []),
    ].filter(Boolean);
    const result = await sharePlain(note.title, [note.body, ...extra].join("\n"));
    if (result === "copied") setMessage("Note copied to clipboard.");
    if (result === "shared") setMessage("Note shared.");
  }

  function renderNoteExtras(note: Note, removable: boolean) {
    const files = filesForNote(note);
    const images = files.filter(isImageNoteFile);
    const docs = files.filter((file) => !isImageNoteFile(file));
    const links = note.links ?? [];
    return (
      <>
        {images.length ? (
          <div className="note-images">
            {images.map((file, index) => {
              const fileIndex = files.indexOf(file);
              return removable ? (
                <figure key={`${note.id}-img-${index}`} className="note-image">
                  <img src={file.dataUrl} alt={file.name} />
                  <button type="button" className="mark-btn" onClick={() => removeFile(note.id, fileIndex)}>
                    Remove
                  </button>
                </figure>
              ) : (
                <img key={`${note.id}-img-${index}`} src={file.dataUrl} alt={file.name} />
              );
            })}
          </div>
        ) : null}
        {docs.length ? (
          <ul className="event-files">
            {docs.map((file) => {
              const fileIndex = files.indexOf(file);
              return (
                <li key={`${note.id}-doc-${file.name}-${fileIndex}`} className="event-file">
                  <a href={file.dataUrl} download={file.name}>{file.name}</a>
                  {removable ? (
                    <button type="button" className="mark-btn" onClick={() => removeFile(note.id, fileIndex)}>
                      Remove
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {links.length ? (
          <ul className="note-links">
            {links.map((href, index) => (
              <li key={`${note.id}-link-${index}`}>
                <a className="recording-link" href={href} target="_blank" rel="noreferrer">
                  {href}
                </a>
                {removable ? (
                  <button type="button" className="mark-btn" onClick={() => removeLink(note.id, index)}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </>
    );
  }

  return (
    <div className="stack page-with-add">
      <h2>Personal notes</h2>
      <button
        className="secondary add-sheet-btn container-btn"
        type="button"
        onClick={() => {
          setEditingId(null);
          setTitle("");
          setBody("");
          setLinkDraft("");
          setSaveError("");
          setAdding(true);
        }}
      >
        New note
      </button>
      <FlashAlert message={message} fading={fading} />
      {studio.notes.length === 0 ? (
        <p className="card empty-alert">No notes yet.</p>
      ) : (
        studio.notes.map((note) => (
          <article key={note.id} className="card stack">
            <h3>{note.title}</h3>
            <p>{note.body}</p>
            {renderNoteExtras(note, false)}
            <div className="mark-row" role="group" aria-label={`Actions for ${note.title}`}>
              <button type="button" className="mark-btn" onClick={() => shareNote(note)}>Share</button>
              <button
                type="button"
                className="mark-btn"
                onClick={() => {
                  setAdding(false);
                  setTitle(note.title);
                  setBody(note.body);
                  setLinkDraft("");
                  setSaveError("");
                  setEditingId(note.id);
                }}
              >
                Edit
              </button>
              <button type="button" className="mark-btn icon-text-btn" onClick={() => deleteNote(note)}>
                <BinIcon title="" />
                Delete
              </button>
            </div>
          </article>
        ))
      )}
      {sheetOpen ? (
        <AddSheet
          titleId="note-sheet-title"
          title={editing ? "Edit note" : "New note"}
          onClose={closeSheet}
        >
          <form className="stack" onSubmit={saveNote}>
            <label>
              Title
              <input
                ref={titleRef}
                name="title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSaveError("");
                }}
              />
            </label>
            <label>
              Note
              <textarea
                name="body"
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  setSaveError("");
                }}
              />
            </label>
            {editing ? renderNoteExtras(editing, true) : null}
            <label>
              Link
              <input
                name="link"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={linkDraft}
                onChange={(event) => {
                  setLinkDraft(event.target.value);
                  setSaveError("");
                }}
              />
            </label>
            <label>
              Media
              <input
                name="media"
                type="file"
                accept=".docx,.pdf,.txt,.jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
              />
            </label>
            <p className="muted">Supported formats are .docx, .pdf, .txt, .jpg, .png, and .gif.</p>
            {saveError ? <p className="error" role="alert">{saveError}</p> : null}
            <button
              className={`forest${noteReady ? "" : " is-idle"}`}
              type="submit"
              aria-disabled={!noteReady}
            >
              {editing ? "Update note" : "Save note"}
            </button>
          </form>
        </AddSheet>
      ) : null}
    </div>
  );
}

function recorderMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
}

function isMp3OrWav(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    name.endsWith(".mp3") ||
    name.endsWith(".wav") ||
    type === "audio/mpeg" ||
    type === "audio/mp3" ||
    type === "audio/wav" ||
    type === "audio/wave" ||
    type === "audio/x-wav" ||
    type === "audio/vnd.wave"
  );
}

function normalizeAudioLink(raw: string) {
  return normalizeHttpLink(raw);
}

export function AudioPage() {
  const { studio, setStudio } = useAuth();
  const [adding, setAdding] = useState(false);
  const [recState, setRecState] = useState<"idle" | "countdown" | "recording" | "paused" | "ready">("idle");
  const [countdown, setCountdown] = useState(0);
  const [recError, setRecError] = useState("");
  const { message, fading, flash } = useFlashMessage();
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recPreview, setRecPreview] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recPreviewRef = useRef("");
  const countTimerRef = useRef(0);
  const countGenRef = useRef(0);
  recPreviewRef.current = recPreview;

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearCountdown() {
    countGenRef.current += 1;
    window.clearInterval(countTimerRef.current);
    countTimerRef.current = 0;
    setCountdown(0);
  }

  function clearRecording() {
    clearCountdown();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopStream();
    if (recPreview) URL.revokeObjectURL(recPreview);
    setRecPreview("");
    setRecordedBlob(null);
    setRecState("idle");
  }

  function closeSheet() {
    clearRecording();
    setRecError("");
    setAdding(false);
  }

  useEffect(() => {
    if (!adding) return;
    titleRef.current?.focus();
  }, [adding]);

  useEffect(() => () => {
    countGenRef.current += 1;
    window.clearInterval(countTimerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (recPreviewRef.current) URL.revokeObjectURL(recPreviewRef.current);
  }, []);

  if (!studio) return null;
  const batches = batchesOf(studio.students);

  function pauseOrResume() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setRecState("paused");
      return;
    }
    if (recorder.state === "paused") {
      recorder.resume();
      setRecState("recording");
    }
  }

  function stopRecording() {
    if (recState !== "recording" && recState !== "paused") return;
    recorderRef.current?.stop();
  }

  async function toggleRecord() {
    if (recState === "countdown") {
      clearCountdown();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      chunksRef.current = [];
      stopStream();
      setRecState("idle");
      return;
    }
    if (recState === "recording" || recState === "paused") return;
    setRecError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecError("Recording is not supported in this browser.");
      return;
    }
    if (recPreview) URL.revokeObjectURL(recPreview);
    setRecPreview("");
    setRecordedBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = recorderMimeType();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopStream();
        recorderRef.current = null;
        if (!blob.size) {
          setRecState("idle");
          return;
        }
        setRecordedBlob(blob);
        setRecPreview(URL.createObjectURL(blob));
        setRecState("ready");
        if (fileRef.current) fileRef.current.value = "";
      };
      recorderRef.current = recorder;
      const gen = ++countGenRef.current;
      let left = 3;
      setCountdown(3);
      setRecState("countdown");
      countTimerRef.current = window.setInterval(() => {
        if (gen !== countGenRef.current) return;
        left -= 1;
        if (left <= 0) {
          window.clearInterval(countTimerRef.current);
          countTimerRef.current = 0;
          setCountdown(0);
          if (recorderRef.current && recorderRef.current.state === "inactive") {
            recorderRef.current.start();
            setRecState("recording");
          }
          return;
        }
        setCountdown(left);
      }, 1000);
    } catch {
      stopStream();
      setRecError("Microphone access is needed to record.");
      setRecState("idle");
    }
  }

  async function addFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recState === "countdown" || recState === "recording" || recState === "paused") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file") as File | null;
    const link = normalizeAudioLink(String(data.get("link") || ""));
    if (String(data.get("link") || "").trim() && !link) {
      setRecError("Enter a valid link.");
      return;
    }
    if (file && file.size && !isMp3OrWav(file)) {
      setRecError("Please choose a .mp3 or .wav file.");
      return;
    }
    const source = file && file.size && isMp3OrWav(file) ? file : recordedBlob;
    if (!source && !link) {
      setRecError("Choose a .mp3 or .wav file, record a clip, or insert a link.");
      return;
    }
    const dataUrl = source ? await readDataUrl(source) : "";
    const fallbackName = source instanceof File
      ? source.name
      : source
        ? "Recorded clip"
        : "Audio link";
    setStudio({
      ...studio,
      recordings: [
        ...studio.recordings,
        {
          id: uid(),
          title: String(data.get("title") || fallbackName),
          batch: String(data.get("batch") || "all"),
          dataUrl,
          url: link || undefined,
        },
      ],
    });
    form.reset();
    closeSheet();
    flash("Recording added.");
  }

  return (
    <div className="stack page-with-add">
      <h2>Audio</h2>
      <button
        className="secondary add-sheet-btn container-btn"
        type="button"
        onClick={() => setAdding(true)}
      >
        Add recording
      </button>
      <FlashAlert message={message} fading={fading} />
      {studio.recordings.length === 0 ? (
        <p className="card empty-alert">No recordings yet.</p>
      ) : (
        studio.recordings.map((clip) => (
          <article key={clip.id} className="card">
            <h3>{clip.title}</h3>
            <p>{clip.batch === "all" || !clip.batch ? "All Batches" : clip.batch}</p>
            {clip.dataUrl || clip.url ? (
              <audio controls src={clip.dataUrl || clip.url}>
                Your browser does not support audio playback.
              </audio>
            ) : null}
            {clip.url ? (
              <a className="recording-link" href={clip.url} target="_blank" rel="noreferrer">
                {clip.url}
              </a>
            ) : null}
          </article>
        ))
      )}
      {adding ? (
        <AddSheet titleId="add-audio-title" title="Add recording" onClose={closeSheet}>
          <form className="stack" onSubmit={addFile}>
            <label>Title <input ref={titleRef} name="title" /></label>
            <label>Batch
              <select name="batch" defaultValue="all">
                <option value="all">All Batches</option>
                {batches.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <div className="file-rec-field">
              <label htmlFor="audio-file">Audio file</label>
              <div className="file-rec-row">
                <input
                  id="audio-file"
                  ref={fileRef}
                  name="file"
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/wave"
                  disabled={recState === "countdown" || recState === "recording" || recState === "paused"}
                  onChange={() => {
                    if (recState === "recording" || recState === "countdown" || recState === "paused") return;
                    if (recPreview) URL.revokeObjectURL(recPreview);
                    setRecPreview("");
                    setRecordedBlob(null);
                    setRecState("idle");
                    setRecError("");
                  }}
                />
                <div className="rec-controls">
                  <div className="rec-slot">
                    <button
                      type="button"
                      className={`icon-well rec-btn rec-start${recState === "countdown" ? " is-count" : ""}${recState === "recording" || recState === "paused" ? " is-hidden" : ""}`}
                      aria-label={recState === "countdown" ? "Cancel countdown" : "Start recording"}
                      aria-hidden={recState === "recording" || recState === "paused"}
                      tabIndex={recState === "recording" || recState === "paused" ? -1 : 0}
                      disabled={recState === "recording" || recState === "paused"}
                      onClick={toggleRecord}
                    >
                      <MicIcon title="" />
                    </button>
                    <button
                      type="button"
                      className={`icon-well rec-btn rec-pause${recState === "paused" ? " is-paused" : recState === "recording" ? " is-live" : ""}${recState === "recording" || recState === "paused" ? "" : " is-hidden"}`}
                      aria-label={recState === "paused" ? "Resume recording" : "Pause recording"}
                      aria-pressed={recState === "paused"}
                      aria-hidden={recState !== "recording" && recState !== "paused"}
                      tabIndex={recState === "recording" || recState === "paused" ? 0 : -1}
                      disabled={recState !== "recording" && recState !== "paused"}
                      onClick={pauseOrResume}
                    >
                      <PauseIcon title="" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`icon-well rec-btn rec-stop is-live${recState === "recording" || recState === "paused" ? "" : " is-hidden"}`}
                    aria-label="Stop recording"
                    aria-hidden={recState !== "recording" && recState !== "paused"}
                    tabIndex={recState === "recording" || recState === "paused" ? 0 : -1}
                    disabled={recState !== "recording" && recState !== "paused"}
                    onClick={stopRecording}
                  >
                    <StopIcon title="" />
                  </button>
                </div>
              </div>
              <p className="muted">Supported audio file formats are .mp3 and .wav.</p>
            </div>
            <label>
              Audio link
              <input name="link" type="url" inputMode="url" placeholder="https://" />
            </label>
            {recState === "countdown" ? (
              <p className="rec-count" role="status">{countdown || 3}</p>
            ) : null}
            {recState === "countdown" ? (
              <p className="muted rec-count-hint">Recording starts after the countdown. Tap the mic to cancel.</p>
            ) : null}
            {recState === "recording" ? <p role="status">Recording… pause or stop when you are done.</p> : null}
            {recState === "paused" ? <p role="status">Paused. Tap pause to resume, or stop to finish.</p> : null}
            {recState === "ready" && recPreview ? (
              <audio controls src={recPreview}>
                Your browser does not support audio playback.
              </audio>
            ) : null}
            {recError ? <p className="error" role="alert">{recError}</p> : null}
            <button className="forest icon-text-btn" type="submit">
              <UploadIcon title="" />
              Upload
            </button>
          </form>
        </AddSheet>
      ) : null}
    </div>
  );
}

const SUPPORT_OTHER = "Other";

function supportWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
const SUPPORT_TOPICS = [
  {
    id: "attendance",
    label: "Attendance related",
    issues: [
      "Student list modification",
      "Class cancellation/restoration",
      "Attendance history",
    ],
  },
  {
    id: "fees",
    label: "Fees related",
    issues: [
      "Fee status modification",
      "Fee payment date",
      "Payment history",
    ],
  },
  {
    id: "events",
    label: "Event related",
    issues: [
      "Scheduling/rescheduling",
      "Cancellation",
      "Sharing",
      "Event history",
    ],
  },
  {
    id: "media",
    label: "Media related",
    issues: [
      "File upload/download",
      "File modification",
      "File history",
    ],
  },
] as const;

export function SettingsPage() {
  const { studio, setStudio } = useAuth();
  const { preference, setPreference } = useTheme();
  const { message: backupMessage, fading, flash: setBackupMessage } = useFlashMessage();
  const { message: supportMessage, fading: supportFading, flash: setSupportMessage } = useFlashMessage();
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTopic, setSupportTopic] = useState<(typeof SUPPORT_TOPICS)[number]["id"] | "">("");
  const [supportIssues, setSupportIssues] = useState<string[]>([]);
  const [supportNotes, setSupportNotes] = useState<Record<string, string>>({});
  const [supportTried, setSupportTried] = useState(false);
  const [supportFlashError, setSupportFlashError] = useState(false);
  const [supportThanks, setSupportThanks] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  if (!studio) return null;

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("avatar") as File | null;
    if (file && file.size) {
      const reader = new FileReader();
      reader.onload = () => {
        setStudio({
          ...studio,
          profile: {
            ...studio.profile,
            full_name: String(data.get("full_name")),
            username: String(data.get("username")),
            avatar_url: String(reader.result),
          },
        });
      };
      reader.readAsDataURL(file);
      return;
    }
    setStudio({
      ...studio,
      profile: {
        ...studio.profile,
        full_name: String(data.get("full_name")),
        username: String(data.get("username")),
      },
    });
  }

  function removeProfilePhoto() {
    if (!studio.profile.avatar_url) return;
    if (avatarRef.current) avatarRef.current.value = "";
    setStudio({
      ...studio,
      profile: {
        ...studio.profile,
        avatar_url: "",
      },
    });
  }

  function downloadBackup() {
    const payload = studio;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sarali-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage("Backup downloaded.");
  }

  function restoreBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = (event.currentTarget.elements.namedItem("backup") as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StudioState & { password?: string };
        if (!parsed?.profile || !Array.isArray(parsed.students)) {
          throw new Error("That file is not a Sarali backup.");
        }
        const { password: _password, ...restored } = parsed;
        setStudio({
          ...restored,
          profile: { ...restored.profile, id: studio.profile.id },
          deletedStudents: Array.isArray(restored.deletedStudents) ? restored.deletedStudents : [],
        });
        setBackupMessage("Backup restored.");
      } catch (error) {
        setBackupMessage((error as Error).message);
      }
    };
    reader.readAsText(file);
  }

  function toggleSupport() {
    if (supportThanks) {
      setSupportThanks(false);
      setSupportOpen(false);
      return;
    }
    setSupportOpen((open) => !open);
  }

  function pickSupportTopic(id: (typeof SUPPORT_TOPICS)[number]["id"]) {
    if (id === supportTopic) return;
    setSupportTopic(id);
    setSupportIssues([]);
    setSupportNotes({});
    setSupportTried(false);
    setSupportFlashError(false);
    setSupportThanks(false);
    setSupportMessage("");
  }

  function toggleSupportIssue(label: string) {
    setSupportIssues((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );
    setSupportFlashError(false);
    setSupportThanks(false);
    setSupportMessage("");
  }

  async function sendSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupportTried(true);
    const topic = SUPPORT_TOPICS.find((item) => item.id === supportTopic);
    if (!topic) {
      setSupportFlashError(true);
      setSupportMessage("Choose a topic first.");
      return;
    }
    if (supportIssues.length === 0) {
      setSupportFlashError(true);
      setSupportMessage("Select at least one issue.");
      return;
    }
    const missingDetail = supportIssues.some((item) => supportWordCount(supportNotes[item] ?? "") < 3);
    if (missingDetail) {
      setSupportFlashError(true);
      setSupportMessage("Please describe each selected issue in at least 3 words.");
      return;
    }
    const lines = supportIssues.map((item) => {
      const detail = (supportNotes[item] ?? "").trim();
      return `• ${item}\n  ${detail}`;
    });
    const result = await sharePlain(
      `Sarali support · ${topic.label}`,
      `${studio.profile.full_name} (@${studio.profile.username})\n${topic.label}\n\n${lines.join("\n")}`
    );
    if (result === "cancelled") return;
    setSupportOpen(false);
    setSupportTopic("");
    setSupportIssues([]);
    setSupportNotes({});
    setSupportTried(false);
    setSupportFlashError(false);
    setSupportThanks(true);
    setSupportMessage("");
  }

  const supportReady =
    Boolean(supportTopic) &&
    supportIssues.length > 0 &&
    supportIssues.every((item) => supportWordCount(supportNotes[item] ?? "") >= 3);
  const topicError = supportTried && !supportTopic;
  const issueError = supportTried && Boolean(supportTopic) && supportIssues.length === 0;
  function noteErrorFor(issue: string) {
    return supportTried && supportIssues.includes(issue) && supportWordCount(supportNotes[issue] ?? "") < 3;
  }

  return (
    <div className="stack">
      <h2>Settings</h2>
      <section className="card stack section-card">
        <h3>Profile</h3>
        {studio.profile.avatar_url ? (
          <div className="profile-photo">
            <img
              src={studio.profile.avatar_url}
              alt={`Portrait of ${studio.profile.full_name}`}
              width={96}
              height={96}
            />
            <button type="button" className="mark-btn" onClick={removeProfilePhoto}>
              Remove photo
            </button>
          </div>
        ) : null}
        <form className="stack" onSubmit={saveProfile}>
          <label>Full name <input name="full_name" defaultValue={studio.profile.full_name} required /></label>
          <label>Username <input name="username" defaultValue={studio.profile.username} required /></label>
          <label>Profile picture <input ref={avatarRef} name="avatar" type="file" accept="image/*" /></label>
          <button type="submit">Save profile</button>
        </form>
      </section>
      <section className="card stack section-card">
        <h3>Appearance</h3>
        <p>Dark mode and device colour scheme are temporarily unavailable. Keep checking back for future updates</p>
        <div className="theme-choices" role="radiogroup" aria-label="Appearance">
          <button
            type="button"
            className="theme-choice theme-choice-light"
            role="radio"
            aria-checked={!DARK_MODE_AVAILABLE || preference === "light"}
            onClick={() => setPreference("light")}
          >
            <span className="theme-choice-mark" aria-hidden="true" />
            Light mode
          </button>
          <button
            type="button"
            className="theme-choice theme-choice-dark"
            role="radio"
            aria-checked={DARK_MODE_AVAILABLE && preference === "dark"}
            disabled={!DARK_MODE_AVAILABLE}
            onClick={() => setPreference("dark")}
          >
            <span className="theme-choice-mark" aria-hidden="true" />
            Dark mode
          </button>
          <button
            type="button"
            className="theme-choice theme-choice-system"
            role="radio"
            aria-checked={DARK_MODE_AVAILABLE && preference === "system"}
            disabled={!DARK_MODE_AVAILABLE}
            onClick={() => setPreference("system")}
          >
            <span>
              <span className="theme-choice-mark" aria-hidden="true" />
              Use device settings
            </span>
          </button>
        </div>
      </section>
      <section className="card stack section-card">
        <h3>Backup</h3>
        <p>Download a copy of this studio, or restore from a previous file.</p>
        <button type="button" className="icon-text-btn backup-download" onClick={downloadBackup}>
          <DownloadIcon title="" />
          Download backup
        </button>
        <form className="stack" onSubmit={restoreBackup}>
          <label>Restore file <input name="backup" type="file" accept="application/json" required /></label>
          <button className="secondary" type="submit">Restore backup</button>
        </form>
        <FlashAlert message={backupMessage} fading={fading} />
      </section>
      <section className="card stack section-card">
        <button
          type="button"
          className="support-open"
          aria-expanded={supportOpen}
          onClick={toggleSupport}
        >
          Support
        </button>
        {supportThanks ? (
          <p className="support-thanks" role="status">
            Thank you for bringing this to our information. We will work on it as soon as possible. In the meantime, please keep an eye on your email inbox for updates and bug fixes.
          </p>
        ) : null}
        {supportOpen ? (
          <form className="stack support-form" onSubmit={sendSupport}>
            <div
              className={`support-blocks${topicError ? " is-error" : ""}`}
              role="radiogroup"
              aria-label="Support topic"
            >
              {SUPPORT_TOPICS.map((topic) => {
                const selected = supportTopic === topic.id;
                return (
                  <div key={topic.id} className="support-block">
                    <button
                      type="button"
                      className="support-topic"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => pickSupportTopic(topic.id)}
                    >
                      {topic.label}
                    </button>
                    {selected ? (
                      <div
                        className={`support-issues${issueError ? " is-error" : ""}`}
                        role="group"
                        aria-label={`${topic.label} issues`}
                      >
                        {[...topic.issues, SUPPORT_OTHER].map((issue) => {
                          const selectedIssue = supportIssues.includes(issue);
                          const detailError = noteErrorFor(issue);
                          return (
                            <div key={issue} className="support-issue-block">
                              <button
                                type="button"
                                className="support-issue"
                                aria-pressed={selectedIssue}
                                onClick={() => toggleSupportIssue(issue)}
                              >
                                {issue}
                              </button>
                              {selectedIssue ? (
                                <label className={`support-other${detailError ? " is-error" : ""}`}>
                                  Add details
                                  <textarea
                                    value={supportNotes[issue] ?? ""}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setSupportNotes((current) => ({ ...current, [issue]: value }));
                                      setSupportFlashError(false);
                                      setSupportThanks(false);
                                      setSupportMessage("");
                                    }}
                                    rows={3}
                                    placeholder="What happened, and when? Use at least 3 words."
                                    aria-invalid={detailError}
                                  />
                                  {detailError ? (
                                    <span className="support-hint">Please describe the issue in at least 3 words.</span>
                                  ) : null}
                                </label>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {issueError ? <p className="support-hint">Select at least one issue.</p> : null}
            {topicError ? <p className="support-hint">Choose a topic first.</p> : null}
            <button
              className={`forest support-send${supportReady ? "" : " is-idle"}`}
              type="submit"
              aria-disabled={!supportReady}
            >
              Send
            </button>
            <FlashAlert
              message={supportMessage}
              fading={supportFading}
              tone={supportFlashError ? "error" : undefined}
            />
          </form>
        ) : null}
      </section>
      <section className="card stack section-card">
        <h3>About</h3>
        <p>Sarali {APP_VERSION}</p>
        <p>Studio app for private music teachers.</p>
      </section>
    </div>
  );
}

