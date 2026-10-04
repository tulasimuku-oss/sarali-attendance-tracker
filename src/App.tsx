import { useCallback, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { AppShell } from "./components/AppShell";
import { SplashScreen } from "./components/SplashScreen";
import {
  AttendancePage,
  AudioPage,
  CalendarPage,
  FeesPage,
  HomePage,
  NotesPage,
  SettingsPage,
  StudentsPage,
} from "./pages/screens";

function AppRoutes() {
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => {
    setSplashDone(true);
  }, []);

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/audio" element={<AudioPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {splashDone ? null : <SplashScreen onDone={finishSplash} />}
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

