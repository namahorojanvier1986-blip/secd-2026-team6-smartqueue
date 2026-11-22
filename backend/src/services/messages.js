/**
 * Customer notification texts in English (en) and Kinyarwanda (rw).
 * The same templates exist in the frontend (src/i18n.jsx) so the ticket page
 * can show every notification in whichever language the customer picks.
 *
 * Params: number ("006"), service, institution, ahead, eta (minutes), counter, priority, soon
 */

function minutesEn(m) {
  if (m <= 0) return 'less than a minute';
  if (m < 60) return `about ${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `about ${h} hour${h > 1 ? 's' : ''}${r ? ` ${r} min` : ''}`;
}

function minutesRw(m) {
  if (m <= 0) return "munsi y'umunota umwe";
  if (m < 60) return m === 1 ? "nk'umunota 1" : `nk'iminota ${m}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `nk'${h === 1 ? 'isaha 1' : `amasaha ${h}`}${r ? ` n'iminota ${r}` : ''}`;
}

const TEMPLATES = {
  en: {
    ticket_issued: (p) => ({
      title: `Ticket ${p.number} confirmed`,
      message:
        `Welcome to ${p.institution}. Your queue number is ${p.number} for ${p.service}` +
        `${p.priority ? ' (priority service)' : ''}. ` +
        (p.ahead === 0 ? 'You are next in line. ' : `${p.ahead} customer${p.ahead === 1 ? ' is' : 's are'} ahead of you. `) +
        `Estimated waiting time: ${minutesEn(p.eta)}. ` +
        (p.soon
          ? 'Your turn is coming up soon, please stay nearby.'
          : 'You may leave the banking hall - we will notify you when your turn is approaching.'),
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
    called: (p) => ({
      title: "It's your turn!",
      message: `Ticket ${p.number}: please proceed to ${p.counter} now.`,
    }),
    recalled: (p) => ({
      title: `${p.counter} is waiting for you`,
      message: `Reminder - ticket ${p.number}: please come to ${p.counter} now or your ticket may be marked as missed.`,
    }),
    completed: (p) => ({
      title: 'Thank you!',
      message: `Ticket ${p.number} has been served. Thank you for banking with us.`,
    }),
    no_show: (p) => ({
      title: 'Ticket missed',
      message: `Ticket ${p.number} was marked as missed because you did not arrive at ${p.counter}. Please request a new ticket.`,
    }),
    cancelled: (p) => ({
      title: 'Ticket cancelled',
      message: `Ticket ${p.number} has been cancelled. You can request a new ticket at any time.`,
    }),
  },

  rw: {
    ticket_issued: (p) => ({
      title: `Tike ${p.number} yemejwe`,
      message:
        `Murakaza neza kuri ${p.institution}. Nimero yawe ku murongo ni ${p.number} kuri serivisi ya ${p.service}` +
        `${p.priority ? ' (uhabwa serivisi mbere)' : ''}. ` +
        (p.ahead === 0
          ? 'Ni wowe ukurikiyeho. '
          : p.ahead === 1
            ? 'Hari umukiriya 1 ukubanziriza. '
            : `Hari abakiriya ${p.ahead} bakubanziriza. `) +
        `Igihe giteganyijwe cyo gutegereza: ${minutesRw(p.eta)}. ` +
        (p.soon
          ? 'Igihe cyawe kiregereje, turagusaba kuguma hafi.'
          : 'Ushobora gusohoka ukajya mu yindi mirimo - tuzakumenyesha igihe cyawe cyegereje.'),
    }),
    turn_approaching: (p) => ({
      title: 'Igihe cyawe kiregereje',
      message:
        `Tike ${p.number}: ` +
        (p.ahead === 0
          ? 'ni wowe ukurikiyeho'
          : p.ahead === 1
            ? 'hasigaye umukiriya 1 gusa ukubanziriza'
            : `hasigaye abakiriya ${p.ahead} gusa bakubanziriza`) +
        ` (${minutesRw(p.eta)}). Turagusaba kugaruka muri banki ubu.`,
    }),
    two_minutes: (p) => ({
      title: 'Hasigaye nk\'iminota 2',
      message:
        `Tike ${p.number}: igihe cyawe kizagera mu minota nka 2` +
        (p.ahead === 0 ? ' - ni wowe ukurikiyeho' : ` (${p.ahead === 1 ? 'hasigaye umukiriya 1' : `hasigaye abakiriya ${p.ahead}`} ukubanziriza)`) +
        '. Turagusaba kuza hafi ya konti ubu.',
    }),
    called: (p) => ({
      title: 'Igihe cyawe kirageze!',
      message: `Tike ${p.number}: turagusaba kujya kuri ${p.counter} ubu.`,
    }),
    recalled: (p) => ({
      title: `${p.counter} iragutegereje`,
      message: `Kwibutsa - tike ${p.number}: ngwino kuri ${p.counter} ubu, bitabaye ibyo tike yawe ishobora guteshwa agaciro.`,
    }),
    completed: (p) => ({
      title: 'Murakoze!',
      message: `Tike ${p.number} yahawe serivisi. Murakoze gukorana natwe.`,
    }),
    no_show: (p) => ({
      title: 'Ntiwitabye',
      message: `Tike ${p.number} yatakaje agaciro kuko utaje kuri ${p.counter}. Turagusaba gufata indi tike.`,
    }),
    cancelled: (p) => ({
      title: 'Tike yahagaritswe',
      message: `Tike ${p.number} yahagaritswe. Ushobora gufata indi tike igihe icyo ari cyo cyose.`,
    }),
  },
};

const LANGUAGES = ['en', 'rw'];

function renderMessage(lang, type, params) {
  const set = TEMPLATES[lang] || TEMPLATES.en;
  return set[type](params);
}

module.exports = { renderMessage, LANGUAGES, minutesEn, minutesRw };
