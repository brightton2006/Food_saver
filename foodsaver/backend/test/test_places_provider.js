const { calculateHaversineKm } = require('../src/services/routingService');

async function testNominatimViewbox(lat, lng, radiusKm) {
  // 1 degree lat is ~111km, 1 degree lon is ~111*cos(lat)
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;

  // viewbox format: <left>,<top>,<right>,<bottom> = minlon,maxlat,maxlon,minlat
  const viewbox = `${minLng},${maxLat},${maxLng},${minLat}`;
  console.log('Testing viewbox:', viewbox);

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=restaurant&viewbox=${viewbox}&bounded=1&limit=25&addressdetails=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'FoodSaver-Test/1.0' } });
  const data = await res.json();
  console.log('Bounded viewbox count:', data.length);
  data.forEach(p => console.log(' ->', p.name || p.display_name.split(',')[0], p.lat, p.lon));
}

testNominatimViewbox(9.1724, 77.8694, 10.0);
