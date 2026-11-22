/**
 * Languages: English (en) and Kinyarwanda (rw).
 * - Every visible text comes from the dictionaries below via t('key', { params }).
 * - The chosen language is remembered on the device; the institution's default
 *   language (set during first-run setup) is used until someone picks one.
 * - Customer notifications are re-written here from their stored data, so the
 *   ticket page shows them in whichever language is selected.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

export const LANGS = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'rw', label: 'Kinyarwanda', short: 'RW' },
];
const LANG_KEY = 'sq_lang';

/* ------------------------------------------------------------------ */
/* Notification templates (mirror backend/src/services/messages.js)     */
/* ------------------------------------------------------------------ */

const minutesEn = (m) => {
  if (m <= 0) return 'less than a minute';
  if (m < 60) return `about ${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `about ${h} hour${h > 1 ? 's' : ''}${r ? ` ${r} min` : ''}`;
};
const minutesRw = (m) => {
  if (m <= 0) return "munsi y'umunota umwe";
  if (m < 60) return m === 1 ? "nk'umunota 1" : `nk'iminota ${m}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `nk'${h === 1 ? 'isaha 1' : `amasaha ${h}`}${r ? ` n'iminota ${r}` : ''}`;
};

const NOTIF = {
  en: {
    ticket_issued: (p) => ({
      title: `Ticket ${p.number} confirmed`,
      message:
        `Welcome to ${p.institution}. Your queue number is ${p.number} for ${p.service}${p.priority ? ' (priority service)' : ''}. ` +
        (p.ahead === 0 ? 'You are next in line. ' : `${p.ahead} customer${p.ahead === 1 ? ' is' : 's are'} ahead of you. `) +
        `Estimated waiting time: ${minutesEn(p.eta)}. ` +
        (p.soon ? 'Your turn is coming up soon, please stay nearby.' : 'You may leave the banking hall - we will notify you when your turn is approaching.'),
    }),
    turn_approaching: (p) => ({
      title: 'Your turn is approaching',
      message:
        `Ticket ${p.number}: ` +
        (p.ahead === 0 ? 'you are next in line' : `only ${p.ahead} customer${p.ahead === 1 ? '' : 's'} ahead of you`) +
        ` (${minutesEn(p.eta)}). Please return to the banking hall now.`,
    }),
    two_minutes: (p) => ({
      title: 'About 2 minutes to your turn',
      message:
        `Ticket ${p.number}: your turn is in about 2 minutes` +
        (p.ahead === 0 ? ' - you are next in line' : ` (${p.ahead} customer${p.ahead === 1 ? '' : 's'} ahead of you)`) +
        '. Please come to the counter area now.',
    }),
    called: (p) => ({ title: "It's your turn!", message: `Ticket ${p.number}: please proceed to ${p.counter} now.` }),
    recalled: (p) => ({
      title: `${p.counter} is waiting for you`,
      message: `Reminder - ticket ${p.number}: please come to ${p.counter} now or your ticket may be marked as missed.`,
    }),
    completed: (p) => ({ title: 'Thank you!', message: `Ticket ${p.number} has been served. Thank you for banking with us.` }),
    no_show: (p) => ({
      title: 'Ticket missed',
      message: `Ticket ${p.number} was marked as missed because you did not arrive at ${p.counter}. Please request a new ticket.`,
    }),
    cancelled: (p) => ({ title: 'Ticket cancelled', message: `Ticket ${p.number} has been cancelled. You can request a new ticket at any time.` }),
  },
  rw: {
    ticket_issued: (p) => ({
      title: `Tike ${p.number} yemejwe`,
      message:
        `Murakaza neza kuri ${p.institution}. Nimero yawe ku murongo ni ${p.number} kuri serivisi ya ${p.service}${p.priority ? ' (uhabwa serivisi mbere)' : ''}. ` +
        (p.ahead === 0 ? 'Ni wowe ukurikiyeho. ' : p.ahead === 1 ? 'Hari umukiriya 1 ukubanziriza. ' : `Hari abakiriya ${p.ahead} bakubanziriza. `) +
        `Igihe giteganyijwe cyo gutegereza: ${minutesRw(p.eta)}. ` +
        (p.soon ? 'Igihe cyawe kiregereje, turagusaba kuguma hafi.' : 'Ushobora gusohoka ukajya mu yindi mirimo - tuzakumenyesha igihe cyawe cyegereje.'),
    }),
    turn_approaching: (p) => ({
      title: 'Igihe cyawe kiregereje',
      message:
        `Tike ${p.number}: ` +
        (p.ahead === 0 ? 'ni wowe ukurikiyeho' : p.ahead === 1 ? 'hasigaye umukiriya 1 gusa ukubanziriza' : `hasigaye abakiriya ${p.ahead} gusa bakubanziriza`) +
        ` (${minutesRw(p.eta)}). Turagusaba kugaruka muri banki ubu.`,
    }),
    two_minutes: (p) => ({
      title: "Hasigaye nk'iminota 2",
      message:
        `Tike ${p.number}: igihe cyawe kizagera mu minota nka 2` +
        (p.ahead === 0 ? ' - ni wowe ukurikiyeho' : ` (${p.ahead === 1 ? 'hasigaye umukiriya 1' : `hasigaye abakiriya ${p.ahead}`} ukubanziriza)`) +
        '. Turagusaba kuza hafi ya konti ubu.',
    }),
    called: (p) => ({ title: 'Igihe cyawe kirageze!', message: `Tike ${p.number}: turagusaba kujya kuri ${p.counter} ubu.` }),
    recalled: (p) => ({
      title: `${p.counter} iragutegereje`,
      message: `Kwibutsa - tike ${p.number}: ngwino kuri ${p.counter} ubu, bitabaye ibyo tike yawe ishobora guteshwa agaciro.`,
    }),
    completed: (p) => ({ title: 'Murakoze!', message: `Tike ${p.number} yahawe serivisi. Murakoze gukorana natwe.` }),
    no_show: (p) => ({ title: 'Ntiwitabye', message: `Tike ${p.number} yatakaje agaciro kuko utaje kuri ${p.counter}. Turagusaba gufata indi tike.` }),
    cancelled: (p) => ({ title: 'Tike yahagaritswe', message: `Tike ${p.number} yahagaritswe. Ushobora gufata indi tike igihe icyo ari cyo cyose.` }),
  },
};

/* ------------------------------------------------------------------ */
/* Dictionaries                                                        */
/* ------------------------------------------------------------------ */

const en = {
  'lang.choose': 'Language',
  'brand.product': 'SmartQueue',
  'brand.sub': 'Smart queue for financial institutions',
  'nav.home': 'Home',
  'nav.backHome': 'Back to home',
  'nav.kiosk': 'Get a ticket',
  'nav.track': 'Track my ticket',
  'nav.display': 'Display board',
  'nav.staff': 'Staff',
  'nav.counter': 'Counter',
  'nav.admin': 'Dashboard',
  'nav.signOut': 'Sign out',
  footer: 'Less time in the queue, more time for your day',
  loading: 'Loading…',
  'notFound.title': 'Page not found',
  'notFound.home': 'Go home',

  'status.waiting': 'Waiting',
  'status.called': 'Called',
  'status.serving': 'Being served',
  'status.served': 'Served',
  'status.no_show': 'Missed',
  'status.cancelled': 'Cancelled',
  priority: 'Priority',
  'reason.pregnant': 'Pregnant woman',
  'reason.elderly': 'Elderly person',
  'reason.disability': 'Person with disability',
  'time.now': 'Now',
  'time.min': '{n} min',
  'time.hours': '{h} h {m} min',
  'time.hoursOnly': '{h} h',

  'err.NETWORK': 'Cannot reach the server. Check your connection.',
  'err.INVALID_PHONE': 'Enter a valid Rwandan mobile number, e.g. 078 123 4567.',
  'err.PRIORITY_REASON': 'Choose the reason for priority service.',
  'err.ACTIVE_TICKET': 'This phone number already has an active ticket today.',
  'err.SERVICE_UNAVAILABLE': 'This service is not available.',
  'err.SERVICE_REQUIRED': 'Choose a service.',
  'err.TICKET_NOT_FOUND': 'Ticket not found. Please check your ticket code.',
  'err.LOOKUP_REQUIRED': 'Enter your phone number and ticket number.',
  'err.LOOKUP_NOT_FOUND': 'No ticket found today for that phone and number.',
  'err.CANCEL_NOT_WAITING': 'Only a waiting ticket can be cancelled.',
  'err.BAD_LOGIN': 'Incorrect username or password.',
  'err.SETUP_REQUIRED': 'The system has not been set up yet.',

  // Home
  'home.title1': 'Keep your place in line',
  'home.title2': 'without standing in it.',
  'home.lead': 'Get a number, leave the banking hall, follow the queue on your phone, and come back when it is your turn.',
  'home.openTicket': 'Open my ticket →',
  'home.trackTicket': 'Track my ticket →',
  'home.yourNumber': 'Your number',
  'home.sampleService': 'Cash Deposit',
  'home.ahead': 'Ahead of you',
  'home.estWait': 'Est. wait',
  'home.where': 'Where would you like to go?',
  'home.kioskText': 'Choose a service, enter your phone number and receive your queue number.',
  'home.trackText': 'See your position, estimated waiting time and live alerts from anywhere.',
  'home.displayText': 'Banking hall screen showing tickets being served and who is next.',
  'home.staffText': 'Tellers call the next customer; managers see reports and configure the system.',
  'home.how': 'How it works',
  'home.step1': 'Take a number',
  'home.step1Text': 'Enter your phone number at the kiosk. You get the next number in line, like 006, with an estimated waiting time.',
  'home.step2': 'Go about your day',
  'home.step2Text': 'No need to stay in the hall. Follow your place in the queue live on your phone.',
  'home.step3': 'Come back in time',
  'home.step3Text': 'You get an alert when your turn is approaching and when a counter calls you.',
  'home.priorityTitle': 'Priority service',
  'home.priorityText':
    'Pregnant women, elderly people and persons with disabilities can request a priority number at the kiosk and are served ahead of the normal queue.',

  // Kiosk
  'kiosk.sub': 'Self-service kiosk',
  'kiosk.welcome': 'Welcome',
  'kiosk.pickService': 'Tap the service you need today.',
  'kiosk.enterPhone': 'Enter your phone number',
  'kiosk.phoneWhy': 'We use it to send your queue updates.',
  'kiosk.ready': 'Your ticket is ready',
  'kiosk.scan': 'Scan the code to follow your place in the queue on your phone.',
  'kiosk.loadingServices': 'Loading services…',
  'kiosk.noServices': 'No services are available right now.',
  'kiosk.waiting': 'Waiting',
  'kiosk.estWait': 'Est. wait',
  'kiosk.clear': 'Clear',
  'kiosk.deleteDigit': 'Delete last digit',
  'kiosk.needPriority': '★ I need priority service',
  'kiosk.priorityHint': 'For pregnant women, elderly people and persons with disabilities. Staff may verify eligibility.',
  'kiosk.selectedService': 'Selected service',
  'kiosk.nWaiting': '{n} waiting',
  'kiosk.yourTicket': 'Your ticket:',
  'kiosk.openIt': 'open it',
  'kiosk.issuing': 'Issuing ticket…',
  'kiosk.getNumber': 'Get my number',
  'kiosk.back': '← Back to services',
  'kiosk.queueNumber': 'Your queue number',
  'kiosk.aheadOfYou': 'Ahead of you',
  'kiosk.expected': 'Expected around',
  'kiosk.phone': 'Phone',
  'kiosk.trackOnPhone': 'Track on your phone',
  'kiosk.scanOr': 'Scan, or go to /track and enter the code',
  'kiosk.okLeave': 'You do not need to wait in the hall.',
  'kiosk.okNext': 'You are next in line - please stay nearby.',
  'kiosk.leaveText':
    'Feel free to run errands. Follow your ticket on your phone - you will be alerted when your turn is approaching and again when a counter calls your number.',
  'kiosk.watchBoard': 'Watch the display board - your number will appear with the counter to go to.',
  'kiosk.done': 'Done',
  'kiosk.resetIn': 'This screen resets in {n}s',
  'kiosk.phoneInvalid': 'Enter a valid Rwandan mobile number starting with 072, 073, 078 or 079.',

  // Track
  'track.title': 'Track my ticket',
  'track.lead': 'See your position in the queue, estimated waiting time and alerts from the bank.',
  'track.continue': 'Continue with your last ticket',
  'track.code': 'Code {code}',
  'track.open': 'Open',
  'track.byCode': 'Ticket code',
  'track.byPhone': 'Phone + number',
  'track.codeLabel': 'Ticket code (printed under the QR code)',
  'track.codePlaceholder': 'e.g. K7M2QX9A',
  'track.phoneLabel': 'Phone number',
  'track.numberLabel': 'Ticket number',
  'track.searching': 'Searching…',
  'track.find': 'Find my ticket',
  'track.noTicket': 'No ticket yet?',
  'track.getOne': 'Get one at the kiosk',

  // Ticket status
  'ts.loading': 'Loading your ticket…',
  'ts.tryAnother': '← Try another code',
  'ts.connProblem': 'Connection problem - showing the last known status. Retrying…',
  'ts.ticket': 'Ticket',
  'ts.next': "You're next! Please be at the banking hall.",
  'ts.approaching': 'Your turn is approaching - please head back now.',
  'ts.twoMinTitle': 'About 2 minutes to your turn',
  'ts.twoMinText': 'Please come to the counter area now and watch the display board.',
  'ts.relax': 'Relax - we will alert you when it is almost your turn.',
  'ts.ahead': 'Ahead',
  'ts.aheadSmall': 'ahead',
  'ts.estWait': 'Est. wait',
  'ts.around': 'Around',
  'ts.noCounter': 'No counter is open for this service yet - the estimate will update when service starts.',
  'ts.called': "It's your turn! Go to {counter} now.",
  'ts.serving': 'You are being served at {counter}.',
  'ts.served': 'Served - thank you for banking with us!',
  'ts.no_show': 'This ticket was marked as missed. Please take a new ticket.',
  'ts.cancelled': 'This ticket was cancelled.',
  'ts.alertsTitle': 'Turn on alerts',
  'ts.alertsBlocked': 'Notifications are blocked in your browser settings. Keep this page open - it will chime when you are called.',
  'ts.alertsText': 'Get a phone notification when your turn is approaching, even if you switch apps.',
  'ts.enable': 'Enable alerts',
  'ts.alertsOnTitle': 'Alerts are on',
  'ts.alertsOnBody': 'We will notify you when your turn is approaching.',
  'ts.notifications': 'Notifications',
  'ts.new': '{n} new',
  'ts.markRead': 'Mark all read',
  'ts.status': 'Status',
  'ts.takenAt': 'Taken at',
  'ts.phone': 'Phone',
  'ts.code': 'Code',
  'ts.giveUp': 'Give up your place in the queue?',
  'ts.keep': 'Keep my place',
  'ts.yesCancel': 'Yes, cancel ticket',
  'ts.cancel': 'Cancel this ticket',
  'ts.newTicket': 'Get a new ticket',
  'ts.autoUpdate': 'This page updates automatically every few seconds.',

  // Display
  'disp.enableSound': '🔊 Enable sound',
  'disp.connecting': 'Connecting to the queue server…',
  'disp.nowServing': 'Now serving',
  'disp.empty': 'Counters will call the next customer shortly.',
  'disp.proceed': 'Please proceed now',
  'disp.beingServed': 'Being served',
  'disp.next': 'Next in line',
  'disp.noOne': 'No one waiting',
  'disp.byService': 'Waiting by service',
  'disp.noWait': 'no wait',
  'disp.ticker1': "🎫 Take a number at the kiosk - you don't have to wait here.",
  'disp.ticker2': '★ Priority service for pregnant women, elderly people and persons with disabilities.',
  'disp.priorityShort': '★ PRIORITY',

  // Login
  'login.title': 'Staff sign in',
  'login.sub': 'Tellers and branch managers.',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.signingIn': 'Signing in…',
  'login.signIn': 'Sign in',

  // Teller
  'tel.choose': 'Choose your counter',
  'tel.open': 'Open',
  'tel.closed': 'Closed',
  'tel.close': 'Close counter',
  'tel.opened': 'Counter opened - you can start calling customers',
  'tel.closedMsg': 'Counter closed',
  'tel.calledMsg': 'Called ticket {n} - customer notified',
  'tel.emptyMsg': 'No customers waiting for your counter',
  'tel.inUse': 'In use by {name}',
  'tel.available': 'Available - tap to open',
  'tel.current': 'Current customer',
  'tel.phone': 'Phone',
  'tel.calledAt': 'Called at',
  'tel.servingFor': 'Serving for',
  'tel.waitingFor': 'Waiting for customer',
  'tel.arrived': '▶ Customer arrived',
  'tel.complete': '✓ Complete',
  'tel.completeNext': '✓ Complete & call next ➜',
  'tel.servedCalled': 'Customer served - called ticket {n}',
  'tel.recall': '🔔 Recall',
  'tel.noShow': '✕ No-show',
  'tel.started': 'Service started',
  'tel.served': 'Customer served',
  'tel.reminded': 'Customer reminded',
  'tel.markedMissed': 'Marked as missed',
  'tel.noCustomers': 'No customers waiting',
  'tel.callNext': 'Call next customer',
  'tel.autoAppear': 'New tickets appear automatically',
  'tel.nextIs': 'Next: {n} · {service}',
  'tel.servedToday': 'Served today',
  'tel.noShows': 'No-shows',
  'tel.avgService': 'Avg service',
  'tel.queueTitle': 'Waiting for this counter',
  'tel.queueEmpty': 'The queue is empty.',
  'tel.speaks': 'Speaks {lang}',

  // Admin
  'adm.title': 'Dashboard',
  'adm.tab.overview': 'Overview',
  'adm.tab.tickets': 'Tickets',
  'adm.tab.services': 'Services',
  'adm.tab.counters': 'Counters',
  'adm.tab.staff': 'Staff',
  'adm.tab.settings': 'Settings',
  'adm.welcomeTitle': 'Your institution is ready',
  'adm.welcomeText':
    'Next steps: add your tellers under Staff, open the Kiosk on the tablet at the entrance, and the Display board on the TV in the banking hall.',
  'adm.addTellers': 'Add tellers',
  'adm.openKiosk': 'Open kiosk',
  'adm.openDisplay': 'Open display board',
  'adm.dismiss': 'Dismiss',
  'adm.daily': 'Daily overview',
  'adm.date': 'Date',
  'adm.kpi.issued': 'Tickets issued',
  'adm.kpi.issuedSub': '{n} priority',
  'adm.kpi.waiting': 'Waiting now',
  'adm.kpi.waitingSub': '{n} at counters',
  'adm.kpi.served': 'Served',
  'adm.kpi.servedSub': '{a} no-shows · {b} cancelled',
  'adm.kpi.avgWait': 'Avg waiting time',
  'adm.kpi.avgWaitSub': 'longest {n} min',
  'adm.kpi.avgWaitNone': 'from ticket to call',
  'adm.kpi.avgService': 'Avg service time',
  'adm.kpi.avgServiceSub': 'per customer',
  'adm.kpi.notifications': 'Notifications sent',
  'adm.kpi.notificationsSub': 'via API (no SMS)',
  'adm.perHour': 'Tickets issued per hour',
  'adm.perHourHint': 'Shows the busiest times of day - useful for planning how many counters to open.',
  'adm.tooltip': '{h}:00 - {n} tickets',
  'adm.asTable': 'View as table',
  'adm.hour': 'Hour',
  'adm.tickets': 'Tickets',
  'adm.byService': 'Tickets by service',
  'adm.service': 'Service',
  'adm.waiting': 'Waiting',
  'adm.served': 'Served',
  'adm.avgWait': 'Avg wait',
  'adm.counterPerf': 'Counter performance',
  'adm.counter': 'Counter',
  'adm.status': 'Status',
  'adm.avgService': 'Avg service',
  'adm.priorityCustomers': 'Priority customers',
  'adm.noPriority': 'No priority tickets on this day.',
  'adm.allStatuses': 'All statuses',
  'adm.noTickets': 'No tickets match.',
  'adm.col.no': 'No.',
  'adm.col.phone': 'Phone',
  'adm.col.lang': 'Lang.',
  'adm.col.issued': 'Issued',
  'adm.col.called': 'Called',
  'adm.col.servedBy': 'Served by',
  'adm.addService': '+ Add service',
  'adm.code': 'Code',
  'adm.name': 'Name',
  'adm.defaultTime': 'Default time',
  'adm.active': 'Active',
  'adm.hidden': 'Hidden',
  'adm.edit': 'Edit',
  'adm.editService': 'Edit service',
  'adm.newService': 'New service',
  'adm.nameEn': 'Name (English)',
  'adm.nameRw': 'Name (Kinyarwanda)',
  'adm.descEn': 'Description (English)',
  'adm.descRw': 'Description (Kinyarwanda)',
  'adm.minutes': 'Default minutes per customer',
  'adm.minutesHint': 'Used for waiting-time estimates until enough real service times are recorded.',
  'adm.showKiosk': 'Show this service at the kiosk',
  'adm.saving': 'Saving…',
  'adm.saveService': 'Save service',
  'adm.serviceSaved': 'Service saved',
  'adm.addCounter': '+ Add counter',
  'adm.servicesHandled': 'Services handled',
  'adm.staffedBy': 'Staffed by {name}',
  'adm.unstaffed': 'Unstaffed',
  'adm.editCounter': 'Edit counter',
  'adm.newCounter': 'New counter',
  'adm.counterPlaceholder': 'Counter 5',
  'adm.counterServices': 'Services this counter handles',
  'adm.saveCounter': 'Save counter',
  'adm.counterSaved': 'Counter saved',
  'adm.staffTitle': 'Staff accounts',
  'adm.addStaff': '+ Add staff',
  'adm.username': 'Username',
  'adm.role': 'Role',
  'adm.disabled': 'Disabled',
  'adm.disable': 'Disable',
  'adm.enable': 'Enable',
  'adm.newStaff': 'New staff member',
  'adm.editStaff': 'Edit {u}',
  'adm.fullName': 'Full name',
  'adm.password': 'Password',
  'adm.newPassword': 'New password (leave blank to keep)',
  'adm.roleTeller': 'Teller - operates a counter',
  'adm.roleAdmin': 'Admin - manages the branch',
  'adm.save': 'Save',
  'adm.accountEnabled': 'Account enabled',
  'adm.accountDisabled': 'Account disabled',
  'adm.staffAdded': 'Staff member added',
  'adm.staffUpdated': 'Staff member updated',
  'role.teller': 'Teller',
  'role.admin': 'Admin',
  'adm.settingsTitle': 'Institution settings',
  'adm.instName': 'Institution name',
  'adm.instHint': 'Shown on the kiosk, display board and in customer notifications.',
  'adm.branchName': 'Branch / location (optional)',
  'adm.defaultLang': 'Default language',
  'adm.defaultLangHint': 'Used on new devices and for customers who have not chosen a language.',
  'adm.approach': '"Turn approaching" alert',
  'adm.approachHint': 'Alert customers when fewer than this many people are ahead of them.',
  'adm.policy': 'Priority service policy',
  'adm.webhook': 'Notification webhook URL (optional)',
  'adm.webhookHint':
    "Every customer notification is also POSTed here as JSON, so your mobile banking app or messaging gateway can deliver it. Leave empty to use the built-in web notifications only.",
  'adm.saveSettings': 'Save settings',
  'adm.settingsSaved': 'Settings saved',

  // First-run setup
  'setup.title': 'Set up your institution',
  'setup.lead': 'Welcome! This is the first time SmartQueue is running here. Setup takes about a minute and is done only once.',
  'setup.step1': 'Institution',
  'setup.step2': 'Services & counters',
  'setup.step3': 'Manager account',
  'setup.instName': 'Institution name',
  'setup.instPlaceholder': 'e.g. Kigali Savings Bank',
  'setup.branch': 'Branch / location (optional)',
  'setup.branchPlaceholder': 'e.g. Nyarugenge Branch',
  'setup.lang': 'Default language for customers',
  'setup.servicesTitle': 'Which services do customers queue for?',
  'setup.servicesHint': 'You can rename, add or remove services later in the dashboard.',
  'setup.counters': 'How many counters does this branch have?',
  'setup.plan': 'How the counters will be organised',
  'setup.managerName': "Manager's full name",
  'setup.username': 'Username',
  'setup.password': 'Password (at least 8 characters)',
  'setup.confirm': 'Confirm password',
  'setup.mismatch': 'The passwords do not match.',
  'setup.shortPassword': 'The password must be at least 8 characters.',
  'setup.needName': 'Enter the name of your institution.',
  'setup.needService': 'Choose at least one service.',
  'setup.needManager': "Enter the manager's name and a username (at least 3 characters).",
  'setup.next': 'Continue',
  'setup.back': 'Back',
  'setup.finish': 'Finish setup & open dashboard',
  'setup.finishing': 'Setting up…',
  'setup.summary': 'Summary',
  'setup.summaryText': '{inst} · {s} services · {c} counters',
};

const rw = {
  'lang.choose': 'Ururimi',
  'brand.product': 'SmartQueue',
  'brand.sub': "Umurongo w'ikoranabuhanga w'ibigo by'imari",
  'nav.home': 'Ahabanza',
  'nav.backHome': 'Subira ahabanza',
  'nav.kiosk': 'Fata tike',
  'nav.track': 'Kurikirana tike',
  'nav.display': 'Ikibaho',
  'nav.staff': 'Abakozi',
  'nav.counter': 'Konteri',
  'nav.admin': 'Ubuyobozi',
  'nav.signOut': 'Sohoka',
  footer: 'Igihe gito ku murongo, igihe kinini ku bindi',
  loading: 'Tegereza gato…',
  'notFound.title': 'Iyi paji ntibonetse',
  'notFound.home': 'Subira ahabanza',

  'status.waiting': 'Arategereje',
  'status.called': 'Yahamagawe',
  'status.serving': 'Arimo guhabwa serivisi',
  'status.served': 'Yahawe serivisi',
  'status.no_show': 'Ntiyitabye',
  'status.cancelled': 'Yahagaritswe',
  priority: 'Uhabwa mbere',
  'reason.pregnant': 'Umugore utwite',
  'reason.elderly': 'Ugeze mu zabukuru',
  'reason.disability': 'Ufite ubumuga',
  'time.now': 'Ubu',
  'time.min': 'iminota {n}',
  'time.hours': 'amasaha {h} n\'iminota {m}',
  'time.hoursOnly': 'amasaha {h}',

  'err.NETWORK': 'Ntibishoboye kugera kuri seriveri. Reba interineti yawe.',
  'err.INVALID_PHONE': 'Andika nimero ya telefoni yo mu Rwanda yemewe, urugero 078 123 4567.',
  'err.PRIORITY_REASON': 'Hitamo impamvu yo guhabwa serivisi mbere.',
  'err.ACTIVE_TICKET': 'Iyi nimero ya telefoni isanzwe ifite tike ikiri ku murongo uyu munsi.',
  'err.SERVICE_UNAVAILABLE': 'Iyi serivisi ntiboneka.',
  'err.SERVICE_REQUIRED': 'Hitamo serivisi.',
  'err.TICKET_NOT_FOUND': 'Tike ntibonetse. Reba neza kode ya tike yawe.',
  'err.LOOKUP_REQUIRED': 'Andika nimero ya telefoni na nimero ya tike.',
  'err.LOOKUP_NOT_FOUND': "Nta tike ibonetse uyu munsi kuri iyo telefoni n'iyo nimero.",
  'err.CANCEL_NOT_WAITING': 'Tike igitegereje ni yo yonyine ishobora guhagarikwa.',
  'err.BAD_LOGIN': 'Izina ukoresha cyangwa ijambobanga si byo.',
  'err.SETUP_REQUIRED': 'Sisitemu ntiratunganywa.',

  'home.title1': 'Gumana umwanya wawe ku murongo',
  'home.title2': 'utiriwe uhagarara.',
  'home.lead': 'Fata nimero, usohoke muri banki, ukurikirane umurongo kuri telefoni yawe, maze ugaruke igihe cyawe kigeze.',
  'home.openTicket': 'Fungura tike yanjye →',
  'home.trackTicket': 'Kurikirana tike yanjye →',
  'home.yourNumber': 'Nimero yawe',
  'home.sampleService': 'Kubitsa amafaranga',
  'home.ahead': 'Bakubanziriza',
  'home.estWait': 'Igihe cyo gutegereza',
  'home.where': 'Ushaka kujya he?',
  'home.kioskText': 'Hitamo serivisi, wandike nimero ya telefoni, uhabwe nimero yawe ku murongo.',
  'home.trackText': "Reba umwanya wawe, igihe uzategereza n'ubutumwa, aho waba uri hose.",
  'home.displayText': "Ikibaho cyo muri banki kigaragaza abahabwa serivisi n'abakurikiyeho.",
  'home.staffText': 'Abakozi bahamagara umukiriya ukurikiyeho; abayobozi babona raporo kandi bagatunganya sisitemu.',
  'home.how': 'Uko bikora',
  'home.step1': 'Fata nimero',
  'home.step1Text': "Andika nimero ya telefoni kuri mashini. Uhabwa nimero ikurikiyeho, nka 006, n'igihe uzategereza.",
  'home.step2': 'Komeza imirimo yawe',
  'home.step2Text': 'Ntugomba kuguma muri banki. Kurikirana umwanya wawe ku murongo kuri telefoni yawe.',
  'home.step3': 'Garuka ku gihe',
  'home.step3Text': "Uhabwa ubutumwa igihe cyawe cyegereje n'igihe uhamagawe kuri konteri.",
  'home.priorityTitle': 'Guhabwa serivisi mbere',
  'home.priorityText':
    "Abagore batwite, abageze mu zabukuru n'abafite ubumuga bashobora gusaba nimero yihariye kuri mashini, bagahabwa serivisi mbere y'abandi.",

  'kiosk.sub': 'Mashini yo kwifatira tike',
  'kiosk.welcome': 'Murakaza neza',
  'kiosk.pickService': 'Kanda kuri serivisi ukeneye uyu munsi.',
  'kiosk.enterPhone': 'Andika nimero ya telefoni yawe',
  'kiosk.phoneWhy': 'Tuyikoresha tukumenyesha uko umurongo ugenda.',
  'kiosk.ready': 'Tike yawe yiteguye',
  'kiosk.scan': 'Sikana iyi kode ukurikirane umwanya wawe ku murongo kuri telefoni.',
  'kiosk.loadingServices': 'Turimo kuzana serivisi…',
  'kiosk.noServices': 'Nta serivisi ziboneka ubu.',
  'kiosk.waiting': 'Bategereje',
  'kiosk.estWait': 'Igihe',
  'kiosk.clear': 'Siba',
  'kiosk.deleteDigit': 'Siba umubare wa nyuma',
  'kiosk.needPriority': '★ Nkeneye guhabwa serivisi mbere',
  'kiosk.priorityHint': "Ku bagore batwite, abageze mu zabukuru n'abafite ubumuga. Abakozi bashobora kubigenzura.",
  'kiosk.selectedService': 'Serivisi wahisemo',
  'kiosk.nWaiting': '{n} bategereje',
  'kiosk.yourTicket': 'Tike yawe:',
  'kiosk.openIt': 'yifungure',
  'kiosk.issuing': 'Turimo gutanga tike…',
  'kiosk.getNumber': 'Mpa nimero',
  'kiosk.back': '← Subira kuri serivisi',
  'kiosk.queueNumber': 'Nimero yawe ku murongo',
  'kiosk.aheadOfYou': 'Bakubanziriza',
  'kiosk.expected': 'Isaha iteganyijwe',
  'kiosk.phone': 'Telefoni',
  'kiosk.trackOnPhone': 'Kurikirana kuri telefoni',
  'kiosk.scanOr': 'Sikana, cyangwa ujye kuri /track wandike kode',
  'kiosk.okLeave': 'Ntugomba gutegerereza muri banki.',
  'kiosk.okNext': 'Ni wowe ukurikiyeho - guma hafi.',
  'kiosk.leaveText':
    "Ushobora kujya mu yindi mirimo. Kurikirana tike yawe kuri telefoni - uzamenyeshwa igihe cyawe cyegereje, n'igihe konteri iguhamagaye.",
  'kiosk.watchBoard': 'Reba ku kibaho - nimero yawe izagaragara hamwe na konteri ugomba kujyaho.',
  'kiosk.done': 'Soza',
  'kiosk.resetIn': 'Iyi paji irasubira ahabanza mu masegonda {n}',
  'kiosk.phoneInvalid': 'Andika nimero ya telefoni itangirwa na 072, 073, 078 cyangwa 079.',

  'track.title': 'Kurikirana tike yanjye',
  'track.lead': "Reba umwanya wawe ku murongo, igihe uzategereza n'ubutumwa buvuye muri banki.",
  'track.continue': 'Komeza na tike yawe iheruka',
  'track.code': 'Kode {code}',
  'track.open': 'Fungura',
  'track.byCode': 'Kode ya tike',
  'track.byPhone': 'Telefoni + nimero',
  'track.codeLabel': 'Kode ya tike (yanditse munsi ya QR code)',
  'track.codePlaceholder': 'urugero: K7M2QX9A',
  'track.phoneLabel': 'Nimero ya telefoni',
  'track.numberLabel': 'Nimero ya tike',
  'track.searching': 'Turashakisha…',
  'track.find': 'Shaka tike yanjye',
  'track.noTicket': 'Nta tike ufite?',
  'track.getOne': 'Yifatire kuri mashini',

  'ts.loading': 'Turimo kuzana tike yawe…',
  'ts.tryAnother': '← Gerageza indi kode',
  'ts.connProblem': 'Ikibazo cya interineti - turerekana amakuru aheruka. Turongera tugerageza…',
  'ts.ticket': 'Tike',
  'ts.next': 'Ni wowe ukurikiyeho! Ba uri muri banki.',
  'ts.approaching': 'Igihe cyawe kiregereje - garuka ubu.',
  'ts.twoMinTitle': "Hasigaye nk'iminota 2",
  'ts.twoMinText': 'Turagusaba kuza hafi ya konti ubu no kureba ku kibaho.',
  'ts.relax': 'Humura - tuzakumenyesha igihe cyawe kigiye kugera.',
  'ts.ahead': 'Bakubanziriza',
  'ts.aheadSmall': 'imbere yawe',
  'ts.estWait': 'Igihe',
  'ts.around': 'Isaha',
  'ts.noCounter': 'Nta konteri irafungura kuri iyi serivisi - igihe giteganyijwe kizahinduka serivisi nitangira.',
  'ts.called': 'Igihe cyawe kirageze! Jya kuri {counter} ubu.',
  'ts.serving': 'Urimo guhabwa serivisi kuri {counter}.',
  'ts.served': 'Wahawe serivisi - murakoze gukorana natwe!',
  'ts.no_show': 'Iyi tike yatakaje agaciro. Fata indi tike.',
  'ts.cancelled': 'Iyi tike yahagaritswe.',
  'ts.alertsTitle': 'Fungura ubutumwa bwo kukumenyesha',
  'ts.alertsBlocked': 'Ubutumwa bwahagaritswe muri mushakisha yawe. Siga iyi paji ifunguye - izavuga igihe uhamagawe.',
  'ts.alertsText': "Menyeshwa kuri telefoni igihe cyawe cyegereje, n'iyo waba uri mu yindi porogaramu.",
  'ts.enable': 'Fungura ubutumwa',
  'ts.alertsOnTitle': 'Ubutumwa bwafunguwe',
  'ts.alertsOnBody': 'Tuzakumenyesha igihe cyawe cyegereje.',
  'ts.notifications': 'Ubutumwa',
  'ts.new': '{n} bushya',
  'ts.markRead': 'Byose byasomwe',
  'ts.status': 'Uko bihagaze',
  'ts.takenAt': 'Yafashwe',
  'ts.phone': 'Telefoni',
  'ts.code': 'Kode',
  'ts.giveUp': 'Urashaka kureka umwanya wawe ku murongo?',
  'ts.keep': 'Gumana umwanya wanjye',
  'ts.yesCancel': 'Yego, hagarika tike',
  'ts.cancel': 'Hagarika iyi tike',
  'ts.newTicket': 'Fata indi tike',
  'ts.autoUpdate': 'Iyi paji yivugurura ubwayo buri masegonda make.',

  'disp.enableSound': '🔊 Fungura ijwi',
  'disp.connecting': 'Turimo guhuza na seriveri…',
  'disp.nowServing': 'Abahabwa serivisi ubu',
  'disp.empty': 'Konteri zirahamagara umukiriya ukurikiyeho vuba.',
  'disp.proceed': 'Ngwino ubu',
  'disp.beingServed': 'Arimo guhabwa serivisi',
  'disp.next': 'Abakurikiyeho',
  'disp.noOne': 'Nta muntu utegereje',
  'disp.byService': 'Abategereje kuri buri serivisi',
  'disp.noWait': 'nta gutegereza',
  'disp.ticker1': '🎫 Fata nimero kuri mashini - ntugomba gutegerereza hano.',
  'disp.ticker2': "★ Abagore batwite, abageze mu zabukuru n'abafite ubumuga bahabwa serivisi mbere.",
  'disp.priorityShort': '★ MBERE',

  'login.title': "Kwinjira kw'abakozi",
  'login.sub': "Abakozi ba konteri n'abayobozi b'ishami.",
  'login.username': 'Izina ukoresha',
  'login.password': 'Ijambobanga',
  'login.signingIn': 'Turinjira…',
  'login.signIn': 'Injira',

  'tel.choose': 'Hitamo konteri yawe',
  'tel.open': 'Irakora',
  'tel.closed': 'Ifunze',
  'tel.close': 'Funga konteri',
  'tel.opened': 'Konteri yafunguwe - ushobora gutangira guhamagara abakiriya',
  'tel.closedMsg': 'Konteri yafunzwe',
  'tel.calledMsg': 'Tike {n} yahamagawe - umukiriya yamenyeshejwe',
  'tel.emptyMsg': 'Nta mukiriya utegereje kuri konteri yawe',
  'tel.inUse': 'Ikoreshwa na {name}',
  'tel.available': 'Irahari - kanda uyifungure',
  'tel.current': 'Umukiriya uriho',
  'tel.phone': 'Telefoni',
  'tel.calledAt': 'Yahamagawe',
  'tel.servingFor': 'Amaze',
  'tel.waitingFor': 'Ategerejwe',
  'tel.arrived': '▶ Umukiriya yaje',
  'tel.complete': '✓ Byarangiye',
  'tel.completeNext': '✓ Byarangiye & hamagara ukurikiyeho ➜',
  'tel.servedCalled': 'Umukiriya yahawe serivisi - tike {n} yahamagawe',
  'tel.recall': '🔔 Ongera uhamagare',
  'tel.noShow': '✕ Ntiyaje',
  'tel.started': 'Serivisi yatangiye',
  'tel.served': 'Umukiriya yahawe serivisi',
  'tel.reminded': 'Umukiriya yibukijwe',
  'tel.markedMissed': 'Byanditswe ko ataje',
  'tel.noCustomers': 'Nta mukiriya utegereje',
  'tel.callNext': 'Hamagara ukurikiyeho',
  'tel.autoAppear': 'Tike nshya zigaragara ubwazo',
  'tel.nextIs': 'Ukurikiyeho: {n} · {service}',
  'tel.servedToday': 'Abakiriwe uyu munsi',
  'tel.noShows': 'Abataje',
  'tel.avgService': 'Igihe cya serivisi',
  'tel.queueTitle': 'Abategereje iyi konteri',
  'tel.queueEmpty': 'Nta muntu uri ku murongo.',
  'tel.speaks': 'Avuga {lang}',

  'adm.title': 'Ubuyobozi',
  'adm.tab.overview': 'Incamake',
  'adm.tab.tickets': 'Tike',
  'adm.tab.services': 'Serivisi',
  'adm.tab.counters': 'Konteri',
  'adm.tab.staff': 'Abakozi',
  'adm.tab.settings': 'Igenamiterere',
  'adm.welcomeTitle': 'Ikigo cyawe cyiteguye',
  'adm.welcomeText':
    "Ibikurikira: ongeramo abakozi ba konteri muri 'Abakozi', fungura Mashini (kiosk) kuri tablette yo ku muryango, n'Ikibaho kuri televiziyo yo muri banki.",
  'adm.addTellers': 'Ongeramo abakozi',
  'adm.openKiosk': 'Fungura mashini',
  'adm.openDisplay': 'Fungura ikibaho',
  'adm.dismiss': 'Funga',
  'adm.daily': "Incamake y'umunsi",
  'adm.date': 'Itariki',
  'adm.kpi.issued': 'Tike zatanzwe',
  'adm.kpi.issuedSub': '{n} bahabwa mbere',
  'adm.kpi.waiting': 'Abategereje ubu',
  'adm.kpi.waitingSub': '{n} kuri konteri',
  'adm.kpi.served': 'Bakiriwe',
  'adm.kpi.servedSub': '{a} ntibaje · {b} bahagaritse',
  'adm.kpi.avgWait': 'Igihe cyo gutegereza (impuzandengo)',
  'adm.kpi.avgWaitSub': 'igihe kirekire: iminota {n}',
  'adm.kpi.avgWaitNone': 'kuva ku tike kugeza ahamagawe',
  'adm.kpi.avgService': 'Igihe cya serivisi (impuzandengo)',
  'adm.kpi.avgServiceSub': 'kuri buri mukiriya',
  'adm.kpi.notifications': 'Ubutumwa bwoherejwe',
  'adm.kpi.notificationsSub': 'binyuze kuri API (nta SMS)',
  'adm.perHour': 'Tike zatanzwe ku isaha',
  'adm.perHourHint': "Bigaragaza amasaha y'umuvundo - bifasha gutegura umubare wa konteri zigomba gukora.",
  'adm.tooltip': '{h}:00 - tike {n}',
  'adm.asTable': 'Reba mu mbonerahamwe',
  'adm.hour': 'Isaha',
  'adm.tickets': 'Tike',
  'adm.byService': 'Tike kuri buri serivisi',
  'adm.service': 'Serivisi',
  'adm.waiting': 'Bategereje',
  'adm.served': 'Bakiriwe',
  'adm.avgWait': 'Igihe cyo gutegereza',
  'adm.counterPerf': 'Imikorere ya konteri',
  'adm.counter': 'Konteri',
  'adm.status': 'Uko bihagaze',
  'adm.avgService': 'Igihe cya serivisi',
  'adm.priorityCustomers': 'Abahabwa serivisi mbere',
  'adm.noPriority': 'Nta tike yihariye yatanzwe kuri uyu munsi.',
  'adm.allStatuses': 'Byose',
  'adm.noTickets': 'Nta tike ibonetse.',
  'adm.col.no': 'Nimero',
  'adm.col.phone': 'Telefoni',
  'adm.col.lang': 'Ururimi',
  'adm.col.issued': 'Yatanzwe',
  'adm.col.called': 'Yahamagawe',
  'adm.col.servedBy': 'Yakiriwe na',
  'adm.addService': '+ Ongeramo serivisi',
  'adm.code': 'Kode',
  'adm.name': 'Izina',
  'adm.defaultTime': 'Igihe gisanzwe',
  'adm.active': 'Irakora',
  'adm.hidden': 'Ihishe',
  'adm.edit': 'Hindura',
  'adm.editService': 'Hindura serivisi',
  'adm.newService': 'Serivisi nshya',
  'adm.nameEn': 'Izina (Icyongereza)',
  'adm.nameRw': 'Izina (Ikinyarwanda)',
  'adm.descEn': 'Ibisobanuro (Icyongereza)',
  'adm.descRw': 'Ibisobanuro (Ikinyarwanda)',
  'adm.minutes': 'Iminota isanzwe kuri buri mukiriya',
  'adm.minutesHint': 'Ikoreshwa mu kubara igihe cyo gutegereza kugeza habonetse amakuru ahagije ya serivisi zatanzwe.',
  'adm.showKiosk': 'Erekana iyi serivisi kuri mashini',
  'adm.saving': 'Turabika…',
  'adm.saveService': 'Bika serivisi',
  'adm.serviceSaved': 'Serivisi yabitswe',
  'adm.addCounter': '+ Ongeramo konteri',
  'adm.servicesHandled': 'Serivisi itanga',
  'adm.staffedBy': 'Ikoreshwa na {name}',
  'adm.unstaffed': 'Nta mukozi uriho',
  'adm.editCounter': 'Hindura konteri',
  'adm.newCounter': 'Konteri nshya',
  'adm.counterPlaceholder': 'Counter 5',
  'adm.counterServices': 'Serivisi iyi konteri itanga',
  'adm.saveCounter': 'Bika konteri',
  'adm.counterSaved': 'Konteri yabitswe',
  'adm.staffTitle': "Konti z'abakozi",
  'adm.addStaff': '+ Ongeramo umukozi',
  'adm.username': 'Izina ukoresha',
  'adm.role': 'Inshingano',
  'adm.disabled': 'Yahagaritswe',
  'adm.disable': 'Hagarika',
  'adm.enable': 'Ongera ukoreshe',
  'adm.newStaff': 'Umukozi mushya',
  'adm.editStaff': 'Hindura {u}',
  'adm.fullName': 'Amazina yombi',
  'adm.password': 'Ijambobanga',
  'adm.newPassword': 'Ijambobanga rishya (siga ubusa niba utarihindura)',
  'adm.roleTeller': 'Umukozi wa konteri',
  'adm.roleAdmin': "Umuyobozi - ayobora ishami",
  'adm.save': 'Bika',
  'adm.accountEnabled': 'Konti yongeye gukora',
  'adm.accountDisabled': 'Konti yahagaritswe',
  'adm.staffAdded': 'Umukozi yongeweho',
  'adm.staffUpdated': 'Amakuru y\'umukozi yavuguruwe',
  'role.teller': 'Umukozi wa konteri',
  'role.admin': 'Umuyobozi',
  'adm.settingsTitle': "Igenamiterere ry'ikigo",
  'adm.instName': "Izina ry'ikigo",
  'adm.instHint': "Rigaragara kuri mashini, ku kibaho no mu butumwa bw'abakiriya.",
  'adm.branchName': 'Ishami / aho giherereye (si ngombwa)',
  'adm.defaultLang': 'Ururimi rusanzwe',
  'adm.defaultLangHint': 'Rukoreshwa ku bikoresho bishya no ku bakiriya batahisemo ururimi.',
  'adm.approach': 'Ubutumwa bw\'"igihe cyegereje"',
  'adm.approachHint': 'Menyesha umukiriya iyo abamubanziriza bari munsi y\'uyu mubare.',
  'adm.policy': 'Amabwiriza yo guhabwa serivisi mbere',
  'adm.webhook': "Aderesi ya webhook y'ubutumwa (si ngombwa)",
  'adm.webhookHint':
    'Buri butumwa bw\'umukiriya bwoherezwa no kuri iyi aderesi (JSON), kugira ngo porogaramu yanyu ya telefoni cyangwa indi sisitemu ibumugezeho. Siga ubusa niba ukoresha ubutumwa bwa hano gusa.',
  'adm.saveSettings': 'Bika igenamiterere',
  'adm.settingsSaved': 'Igenamiterere ryabitswe',

  'setup.title': 'Tunganya ikigo cyawe',
  'setup.lead': "Murakaza neza! Ni ubwa mbere SmartQueue ikoreshejwe hano. Bifata nk'umunota umwe, kandi bikorwa rimwe gusa.",
  'setup.step1': 'Ikigo',
  'setup.step2': 'Serivisi na konteri',
  'setup.step3': "Konti y'umuyobozi",
  'setup.instName': "Izina ry'ikigo",
  'setup.instPlaceholder': 'urugero: Kigali Savings Bank',
  'setup.branch': 'Ishami / aho giherereye (si ngombwa)',
  'setup.branchPlaceholder': 'urugero: Ishami rya Nyarugenge',
  'setup.lang': "Ururimi rusanzwe rw'abakiriya",
  'setup.servicesTitle': 'Ni izihe serivisi abakiriya bategerereza?',
  'setup.servicesHint': 'Ushobora guhindura, kongeramo cyangwa gukuraho serivisi nyuma, mu buyobozi.',
  'setup.counters': 'Iri shami rifite konteri zingahe?',
  'setup.plan': 'Uko konteri zizateguwa',
  'setup.managerName': "Amazina y'umuyobozi",
  'setup.username': 'Izina ukoresha',
  'setup.password': 'Ijambobanga (nibura inyuguti 8)',
  'setup.confirm': 'Emeza ijambobanga',
  'setup.mismatch': 'Amagambobanga ntabwo ahura.',
  'setup.shortPassword': 'Ijambobanga rigomba kugira nibura inyuguti 8.',
  'setup.needName': "Andika izina ry'ikigo cyawe.",
  'setup.needService': 'Hitamo nibura serivisi imwe.',
  'setup.needManager': "Andika amazina y'umuyobozi n'izina ukoresha (nibura inyuguti 3).",
  'setup.next': 'Komeza',
  'setup.back': 'Subira inyuma',
  'setup.finish': 'Soza ujye mu buyobozi',
  'setup.finishing': 'Turimo gutunganya…',
  'setup.summary': 'Incamake',
  'setup.summaryText': '{inst} · serivisi {s} · konteri {c}',
};

const DICT = { en, rw };

const RW_DAYS = ['Ku cyumweru', 'Kuwa mbere', 'Kuwa kabiri', 'Kuwa gatatu', 'Kuwa kane', 'Kuwa gatanu', 'Kuwa gatandatu'];
const RW_MONTHS = ['Mutarama', 'Gashyantare', 'Werurwe', 'Mata', 'Gicurasi', 'Kamena', 'Nyakanga', 'Kanama', 'Nzeri', 'Ukwakira', 'Ugushyingo', 'Ukuboza'];

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [info, setInfo] = useState(null);
  const [infoError, setInfoError] = useState(null);
  const [lang, setLangState] = useState(() => localStorage.getItem(LANG_KEY));

  const refreshInfo = useCallback(async () => {
    try {
      const i = await api('/info');
      setInfo(i);
      setInfoError(null);
      return i;
    } catch (e) {
      setInfoError(e);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshInfo();
  }, [refreshInfo]);

  const current = lang || info?.defaultLanguage || 'en';

  useEffect(() => {
    document.documentElement.lang = current === 'rw' ? 'rw' : 'en';
  }, [current]);

  const setLang = useCallback((l) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  }, []);

  const value = useMemo(() => {
    const dict = DICT[current] || en;
    const t = (key, params) => {
      let s = dict[key] ?? en[key] ?? key;
      if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
      return s;
    };
    // Pick the service name in the current language
    const svc = (s) => (s ? (current === 'rw' ? s.nameRw || s.name : s.name) : '');
    const svcDesc = (s) => (s ? (current === 'rw' ? s.descriptionRw || s.description : s.description) : '');
    const wait = (m) => {
      if (m === null || m === undefined) return '-';
      if (m <= 0) return t('time.now');
      if (m < 60) return t('time.min', { n: m });
      const h = Math.floor(m / 60);
      const r = m % 60;
      return r ? t('time.hours', { h, m: r }) : t('time.hoursOnly', { h });
    };
    const date = (d) =>
      current === 'rw'
        ? `${RW_DAYS[d.getDay()]}, ${d.getDate()} ${RW_MONTHS[d.getMonth()]} ${d.getFullYear()}`
        : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const notif = (n) => {
      const tpl = NOTIF[current]?.[n.type];
      if (!tpl || !n.data || !n.data.number) return { title: n.title, message: n.message };
      return tpl({ ...n.data, service: current === 'rw' ? n.data.serviceRw || n.data.service : n.data.service });
    };
    const error = (e) => {
      if (!e) return '';
      if (e.status === 0) return t('err.NETWORK');
      const code = e.data?.errorCode;
      return code && dict[`err.${code}`] ? dict[`err.${code}`] : e.message;
    };
    return { lang: current, setLang, t, svc, svcDesc, wait, date, notif, error, info, infoError, refreshInfo };
  }, [current, setLang, info, infoError, refreshInfo]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

/** EN | RW toggle. `variant="dark"` for navy backgrounds. */
export function LanguageSwitcher({ variant = 'dark', size = 'sm' }) {
  const { lang, setLang, t } = useApp();
  return (
    <div className={`lang-switch lang-${variant} lang-${size}`} role="group" aria-label={t('lang.choose')}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" className={lang === l.id ? 'on' : ''} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} title={l.label}>
          {size === 'lg' ? l.label : l.short}
        </button>
      ))}
    </div>
  );
}
