import { BrowserRouter, Routes, Route } from 'react-router';
import HomePage from './components/HomePage';
import TourPage from './components/TourPage';
import AdminPanel from './components/ui/AdminPanel';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tour" element={<TourPage />} />
        <Route path="/admin" element={<AdminPanel />} />  {/* ← moved inside */}
      </Routes>
    </BrowserRouter>
  );
}