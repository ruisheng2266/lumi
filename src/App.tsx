import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { Today } from './pages/Today';
import { Calendar } from './pages/Calendar';
import { Log } from './pages/Log';
import { Insights } from './pages/Insights';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';

export default function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/log" element={<Log />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}