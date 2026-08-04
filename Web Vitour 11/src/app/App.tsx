import { BrowserRouter, Routes, Route } from 'react-router';
import HomePage from './components/HomePage';
import TourPage from './components/TourPage';
import Admin from './components/AdminPanel';
import Details from './components/DetailRoom';
import RoomMap from './components/RoomMap';

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