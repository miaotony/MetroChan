import './styles/main.css';
import { getHearing, onHearingChange, setHearing } from './core/hearing';
import { initChange } from './panels/change';
import { initCities } from './panels/cities';
import { initDistance } from './panels/distance';
import { initStations } from './panels/s2s';
import { initChrome } from './ui/chrome';
import { byId } from './ui/dom';
import { initNavigation } from './ui/navigation';
import { initShare } from './ui/share';

initNavigation();
const toggles = ['showHearing', 'showHearingS2s'].map(id => byId<HTMLInputElement>(id));
toggles.forEach(toggle => toggle.addEventListener('change', () => setHearing(toggle.checked)));
onHearingChange(() => {
  document.body.classList.toggle('show-hearing', getHearing());
  toggles.forEach(toggle => { toggle.checked = getHearing(); });
});
initDistance();
initCities();
const stations = initStations();
initShare(stations);
initChange();
initChrome();
