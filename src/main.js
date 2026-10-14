import './style.css';
import * as core from './core.js';
const {setCur,render}=core;window.PTL=core; // console/test handle
import {S} from './sync.js';
import './views.js';
setCur({v:'home'});render();
S.init();
if('serviceWorker' in navigator&&location.protocol!=='file:'&&!location.hostname.match(/^(localhost|127\.)/))navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js');
