import { initAvatar } from './avatar3d.js';
import { initDiagram } from './bodyDiagram.js';
import { initI18n } from './i18n.js';
import { initDashboard } from './measurementDashboard.js';
import { initNavigation } from './navigation.js';
import { initReport } from './report.js';
import { loadPreferences } from './state.js';
import { initStudio } from './studio.js';
import { initGlobalErrors } from './utils.js';

loadPreferences();
initI18n();
initNavigation();
initStudio();
initDashboard();
initDiagram();
initReport();
initGlobalErrors();
initAvatar();
