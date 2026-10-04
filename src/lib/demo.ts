import type { Plan } from "./plans";

export type AttendanceStatus = "present" | "remote" | "absent" | "cancelled";
export type FeeStatus = "paid" | "pending";

export type Student = {
  id: string;
  name: string;
  batch: string;
  batches?: string[];
  rate_cents: number;
};

export const MAX_STUDENT_CLASSES = 2;
const STUDENT_CLASS_SEP = " · ";

export function uniqueClassNames(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of values) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function studentBatches(student: Pick<Student, "batch" | "batches">): string[] {
  const source = student.batches?.length ? student.batches : [student.batch ?? ""];
  return uniqueClassNames(source).slice(0, MAX_STUDENT_CLASSES);
}

export function studentInBatch(student: Pick<Student, "batch" | "batches">, batch: string): boolean {
  return studentBatches(student).includes(batch);
}

export function formatStudentBatches(student: Pick<Student, "batch" | "batches">): string {
  return studentBatches(student).join(STUDENT_CLASS_SEP);
}

export function parseStudentBatchLabel(label: string): string[] {
  return uniqueClassNames(label.split(/\s*·\s*|\s*,\s*/));
}

export function assignStudentBatches<T extends Pick<Student, "batch" | "batches">>(
  student: T,
  batches: Iterable<string>
): T {
  const next = uniqueClassNames(batches).slice(0, MAX_STUDENT_CLASSES);
  return { ...student, batch: next[0] ?? "", batches: next };
}

export type Attendance = {
  id: string;
  student_id: string;
  lesson_date: string;
  status: AttendanceStatus;
  note?: string;
  student_name?: string;
  student_batch?: string;
  updated_at?: string;
};

export type EventFile = {
  name: string;
  mime: string;
  dataUrl: string;
};

export type Fee = {
  id: string;
  student_id: string;
  period: string;
  status: FeeStatus;
  amount_cents?: number;
  paid_on?: string;
  note?: string;
  upi_screenshot?: EventFile;
};

export type EventItem = {
  id: string;
  title: string;
  starts_at: string;
  notes: string;
  status: "scheduled" | "cancelled";
  cancelled_at?: string;
  batch?: string;
  files?: EventFile[];
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export function canUncancelEvent(event: EventItem, now = Date.now()) {
  if (event.status !== "cancelled") return false;
  if (!event.cancelled_at) return true;
  const cancelledAt = new Date(event.cancelled_at).getTime();
  if (Number.isNaN(cancelledAt)) return false;
  return now - cancelledAt <= TWO_WEEKS_MS;
}

export type Note = {
  id: string;
  title: string;
  body: string;
  images: string[];
  files?: EventFile[];
  links?: string[];
};

export type Recording = {
  id: string;
  title: string;
  batch: string;
  dataUrl: string;
  url?: string;
};

export type Profile = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  avatar_url: string;
  plan: Plan;
};

export type StudioState = {
  profile: Profile;
  students: Student[];
  deletedStudents: Student[];
  attendance: Attendance[];
  fees: Fee[];
  events: EventItem[];
  notes: Note[];
  recordings: Recording[];
};

const KEY = "sarali.demo.v1";

function uid() {
  return crypto.randomUUID();
}

function withoutPassword(studio: StudioState & { password?: string }): StudioState {
  const { password: _password, ...rest } = studio;
  return rest;
}

export function loadDemoUsers(): StudioState[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Array<
      StudioState & { password?: string }
    >;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(withoutPassword);
  } catch {
    return [];
  }
}

function save(users: StudioState[]) {
  localStorage.setItem(KEY, JSON.stringify(users));
}

export function registerDemo(input: {
  username: string;
  email: string;
  full_name: string;
}): StudioState {
  const users = loadDemoUsers();
  if (users.some((u) => u.profile.email === input.email || u.profile.username === input.username)) {
    throw new Error("That email or username is already registered.");
  }
  const next: StudioState = {
    profile: {
      id: uid(),
      username: input.username,
      email: input.email,
      full_name: input.full_name,
      avatar_url: "",
      plan: "free",
    },
    students: [],
    deletedStudents: [],
    attendance: [],
    fees: [],
    events: [],
    notes: [],
    recordings: [],
  };
  users.push(next);
  save(users);
  sessionStorage.setItem("sarali.session", next.profile.id);
  return next;
}

export function currentDemo(): StudioState | null {
  const id = sessionStorage.getItem("sarali.session");
  if (!id) return null;
  return loadDemoUsers().find((u) => u.profile.id === id) ?? null;
}

export function ensureLocalStudio(): StudioState {
  const existing = currentDemo();
  if (existing) {
    const filled = withStudioDefaults(existing);
    if (filled !== existing) updateDemo(filled);
    return filled;
  }
  const users = loadDemoUsers();
  if (users[0]) {
    sessionStorage.setItem("sarali.session", users[0].profile.id);
    const filled = withStudioDefaults(users[0]);
    updateDemo(filled);
    return filled;
  }
  const created = registerDemo({
    username: "teacher",
    email: "studio@local",
    full_name: "Your studio",
  });
  const filled = withStudioDefaults(created);
  updateDemo(filled);
  return filled;
}

const DUMMY_ROSTER: Array<Omit<Student, "id">> = [
  { name: "Meera Iyer", batch: "Beginner Vocal", rate_cents: 150000 },
  { name: "Arjun Rao", batch: "Beginner Vocal", rate_cents: 150000 },
  { name: "Diya Sharma", batch: "Intermediate Violin", rate_cents: 180000 },
  { name: "Kabir Menon", batch: "Intermediate Violin", rate_cents: 180000 },
  { name: "Ananya Patel", batch: "Carnatic Advanced", rate_cents: 250000 },
  { name: "Rohit Nair", batch: "Carnatic Advanced", rate_cents: 250000 },
  { name: "Sara Khan", batch: "Keyboard Kids", rate_cents: 120000 },
  { name: "Vivaan Shah", batch: "Keyboard Kids", rate_cents: 120000 },
];

function dummyProfileFor(name: string) {
  return DUMMY_ROSTER.find((student) => student.name === name);
}

function inferDeletedStudents(studio: StudioState): Student[] {
  const liveIds = new Set((studio.students ?? []).map((student) => student.id));
  const deleted = Array.isArray(studio.deletedStudents) ? [...studio.deletedStudents] : [];
  const known = new Set(deleted.map((student) => student.id));
  const missingIds = new Set<string>();
  for (const row of studio.attendance ?? []) {
    if (row.student_id && !liveIds.has(row.student_id)) missingIds.add(row.student_id);
  }
  for (const fee of studio.fees ?? []) {
    if (fee.student_id && !liveIds.has(fee.student_id)) missingIds.add(fee.student_id);
  }
  for (const id of missingIds) {
    if (known.has(id)) continue;
    const rows = (studio.attendance ?? []).filter((row) => row.student_id === id);
    const name =
      rows.find((row) => row.student_name && row.student_name !== "Removed student")?.student_name ??
      "Removed student";
    const batch =
      rows.find((row) => row.student_batch)?.student_batch ?? dummyProfileFor(name)?.batch ?? "";
    deleted.push(assignStudentBatches({
      id,
      name,
      batch,
      rate_cents: dummyProfileFor(name)?.rate_cents ?? 0,
    }, parseStudentBatchLabel(batch)));
    known.add(id);
  }
  return deleted;
}

function withStudioDefaults(studio: StudioState): StudioState {
  const notes = (studio.notes ?? []).map((note) => ({
    ...note,
    images: Array.isArray(note.images) ? note.images : [],
    files: Array.isArray(note.files) ? note.files : [],
    links: Array.isArray(note.links) ? note.links : [],
  }));
  const events = (Array.isArray(studio.events) ? studio.events : dummyEvents()).map((event) => ({
    ...event,
    status: event.status === "cancelled" ? "cancelled" as const : "scheduled" as const,
    cancelled_at: event.status === "cancelled" ? event.cancelled_at : undefined,
    notes: event.notes ?? "",
    files: Array.isArray(event.files) ? event.files : [],
  }));
  const sourceRecordings = studio.recordings ?? [];
  const recordings = sourceRecordings.some((clip) => {
    const row = clip as Recording & { student_id?: string };
    return typeof row.batch !== "string" || Boolean(row.student_id);
  })
    ? sourceRecordings.map((clip) => {
        const row = clip as Recording & { student_id?: string };
        const student = studio.students.find((item) => item.id === row.student_id);
        return {
          id: row.id,
          title: row.title,
          dataUrl: row.dataUrl,
          batch: row.batch || student?.batch || "all",
          url: row.url,
        };
      })
    : sourceRecordings;
  const deletedStudents = inferDeletedStudents(studio).map((student) =>
    assignStudentBatches(student, studentBatches(student))
  );
  const rawStudents = studio.students.length
    ? studio.students
    : deletedStudents.length
      ? studio.students
      : DUMMY_ROSTER.map((student) => ({ ...student, id: uid() }));
  const students = rawStudents.map((student) => assignStudentBatches(student, studentBatches(student)));
  const attendanceSource = studio.attendance ?? [];
  const nextAttendance = attendanceSource.map((row) => {
    if (row.student_name && row.student_batch) return row;
    const student = students.find((item) => item.id === row.student_id);
    if (!student) {
      if (row.student_name || row.student_batch) return row;
      return { ...row, student_name: "Removed student", student_batch: row.student_batch ?? "" };
    }
    return {
      ...row,
      student_name: row.student_name || student.name,
      student_batch: row.student_batch || formatStudentBatches(student),
    };
  });
  const attendance =
    nextAttendance.length === attendanceSource.length &&
    nextAttendance.every((row, index) => row === attendanceSource[index])
      ? attendanceSource
      : nextAttendance;
  const next = {
    ...studio,
    students,
    deletedStudents,
    attendance,
    notes,
    events,
    recordings,
  };
  const unchanged =
    next.students === studio.students &&
    next.deletedStudents === studio.deletedStudents &&
    next.attendance === studio.attendance &&
    next.notes === studio.notes &&
    next.events === studio.events &&
    next.recordings === studio.recordings;
  return unchanged ? studio : next;
}

const SEVA_TITLE = "August temple sangeetha seva";
const LEGACY_DUMMY_TITLES = new Set([
  "Beginner Vocal",
  "Intermediate Violin",
  "Carnatic Advanced",
  "Keyboard Kids",
  "Makeup lesson · Meera Iyer",
  "Studio recital rehearsal",
  SEVA_TITLE,
]);

export function dummyEvents(): EventItem[] {
  return [
    {
      id: uid(),
      title: SEVA_TITLE,
      starts_at: daysFromNow(8, 15, 30),
      notes: "All batches — August temple sangeetha seva.",
      status: "scheduled",
    },
  ];
}

export function withSeededEvents(events: EventItem[]): EventItem[] {
  return events;
}

export function toLocalDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function daysFromNow(days: number, hours: number, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return toLocalDateTime(date);
}

export async function sharePlain(title: string, text: string) {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title, text });
      return "shared" as const;
    }
  } catch (error) {
    if ((error as DOMException).name === "AbortError") return "cancelled" as const;
  }
  try {
    await navigator.clipboard.writeText(`${title}\n\n${text}`);
    return "copied" as const;
  } catch {
    window.prompt("Copy this", `${title}\n\n${text}`);
    return "copied" as const;
  }
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthISO(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function sixMonthsAgoISO() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

export function sixMonthsAgoMonth() {
  return sixMonthsAgoISO().slice(0, 7);
}

export function batchesOf(students: Student[], attendance: Attendance[] = []) {
  return uniqueClassNames([
    ...students.flatMap((student) => studentBatches(student)),
    ...attendance.flatMap((row) => parseStudentBatchLabel(row.student_batch ?? "")),
  ]);
}

export function futureAttendanceWithStudent(
  attendance: Attendance[],
  studentId: string,
  today: string,
  profile: { student_name: string; student_batch: string }
) {
  return attendance.map((row) =>
    row.student_id === studentId && row.lesson_date >= today
      ? { ...row, ...profile }
      : row
  );
}

export function updateDemo(studio: StudioState) {
  const users = loadDemoUsers().map((u) => (u.profile.id === studio.profile.id ? studio : u));
  save(users);
}

export { uid };
