import { BrowserRouter, Routes, Route } from 'react-router';
import HomePage from './components/User/HomePage';
import TourPage from './components/User/TourPage';
import Admin from './components/Admin/AdminPanel';
import Details from './components/User/DetailRoom';
import RoomMap from './components/User/RoomMap';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Users */}
        <Route path="/" element={<HomePage />} />
        <Route path="/tour" element={<TourPage />} />
        <Route path="/Details" element={<RoomMap />} />
        <Route path="/Details/:id" element={<Details />} />

        {/* Admins */}
        <Route path="/Admin-Panels" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}