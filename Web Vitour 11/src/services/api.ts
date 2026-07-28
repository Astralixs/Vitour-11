const BASE_URL = import.meta.env.VITE_API_URL;

// LOCATIONS
export const getLocations = async () => {
  const res = await fetch(`${BASE_URL}/api/locations`);
  return res.json();
};

export const createLocation = async (data: FormData) => {
  const res = await fetch(`${BASE_URL}/api/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deleteLocation = async (id: number) => {
  const res = await fetch(`${BASE_URL}/api/locations/${id}`, { method: 'DELETE' });
  return res.json();
};

// PANORAMAS
export const getPanoramas = async (location_id: number) => {
  const res = await fetch(`${BASE_URL}/api/panoramas?location_id=${location_id}`);
  return res.json();
};

export const createPanorama = async (data: { location_id: number; title: string; image_url: string }) => {
  const res = await fetch(`${BASE_URL}/api/panoramas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deletePanorama = async (id: number) => {
  const res = await fetch(`${BASE_URL}/api/panoramas/${id}`, { method: 'DELETE' });
  return res.json();
};

// HOTSPOTS
export const getHotspots = async (panorama_id: number) => {
  const res = await fetch(`${BASE_URL}/api/hotspots?panorama_id=${panorama_id}`);
  return res.json();
};

export const getTourConfig = async (location_id: number) => {
  const res = await fetch(`${BASE_URL}/api/locations/${location_id}/tour`);
  return res.json();
};
