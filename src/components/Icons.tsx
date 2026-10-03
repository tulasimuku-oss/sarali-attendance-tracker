type IconProps = {
  title: string;
  className?: string;
};

function AssetIcon({
  title,
  className,
  src,
  srcActive,
}: IconProps & { src: string; srcActive?: string }) {
  return (
    <span
      className={["brand-icon", srcActive ? "has-active" : "", className].filter(Boolean).join(" ")}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <img className="brand-icon-idle" src={src} alt="" draggable={false} />
      {srcActive ? <img className="brand-icon-active" src={srcActive} alt="" draggable={false} /> : null}
    </span>
  );
}

export function HomeIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/home.svg" srcActive="/icons/home-active.svg" />;
}

export function StudentsIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/students.svg" />;
}

export function CalendarIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/calendar.svg" srcActive="/icons/calendar-active.svg" />;
}

export function NotesIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/notes.svg" srcActive="/icons/notes-active.svg" />;
}

export function ProfileIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/profile.png" />;
}

export function AttendanceIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/attendance.svg" srcActive="/icons/attendance-active.svg" />;
}

export function FeesIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/fees.svg" srcActive="/icons/fees-active.svg" />;
}

export function AudioIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/audio.svg" />;
}

export function SettingsIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/settings.png" />;
}

export function CloseIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/close.svg" />;
}

export function MicIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/mic.svg" />;
}

export function PauseIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/pause.svg" />;
}

export function StopIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/stop.svg" />;
}

export function UploadIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/upload.svg" />;
}

export function DownloadIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/download.svg" />;
}

export function PresentIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/present.svg" />;
}

export function RemoteIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/remote.svg" />;
}

export function AbsentIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/absent.svg" />;
}

export function ShareIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/share.svg" />;
}

export function PencilIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/edit.svg" />;
}

export function BinIcon(props: IconProps) {
  return <AssetIcon {...props} src="/icons/delete.svg" />;
}
