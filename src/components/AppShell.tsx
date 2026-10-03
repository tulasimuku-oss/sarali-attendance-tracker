import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import {
  AttendanceIcon,
  CalendarIcon,
  FeesIcon,
  HomeIcon,
  NotesIcon,
  ProfileIcon,
  SettingsIcon,
} from "./Icons";

export function AppShell() {
  const { studio, loading } = useAuth();
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  if (loading || !studio) {
    return (
      <div className="app-shell">
        <p>Opening studio…</p>
      </div>
    );
  }

  const showProfile = isHome && !scrolled;
  const avatar = studio.profile.avatar_url;

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink
          to="/settings"
          className={`icon-well header-settings${showProfile ? " is-avatar" : ""}`}
          aria-label={showProfile ? "Profile" : "Settings"}
        >
          {showProfile && avatar ? (
            <img src={avatar} alt="" />
          ) : showProfile ? (
            <ProfileIcon title="" />
          ) : (
            <SettingsIcon title="" />
          )}
        </NavLink>
        <div>
          <p className="muted" style={{ margin: 0 }}>Sarali</p>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{studio.profile.full_name}</h1>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <nav className="nav-bar" aria-label="Primary">
        <NavLink to="/" end>
          <span className="icon-well"><HomeIcon title="" /></span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/attendance">
          <span className="icon-well"><AttendanceIcon title="" /></span>
          <span>Attendance</span>
        </NavLink>
        <NavLink to="/fees">
          <span className="icon-well"><FeesIcon title="" /></span>
          <span>Fees</span>
        </NavLink>
        <NavLink to="/calendar">
          <span className="icon-well"><CalendarIcon title="" /></span>
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/notes">
          <span className="icon-well"><NotesIcon title="" /></span>
          <span>Notes</span>
        </NavLink>
      </nav>
    </div>
  );
}
