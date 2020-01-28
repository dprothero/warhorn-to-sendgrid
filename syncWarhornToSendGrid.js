require('dotenv').config();

const fetch = require('node-fetch');
const parseCsv = require('csv-parse/lib/sync');

async function getWarhornPlayers() {
  const PLAYER_CSV_URL = `https://warhorn.net/events/${process.env.WARHORN_EVENT_ID}/manage/registrations/envelope.csv`;

  const response = await fetch(PLAYER_CSV_URL, {
    headers: {
      Pragma: 'no-cache',
      'Cache-Control': 'no-cache',
      Cookie: `_destro_session=${process.env.WARHORN_TOKEN}`
    }
  });

  const text = await response.text();
  const players = parseCsv(text, {
    columns: true,
    skip_empty_lines: true
  });

  return players;
}

async function getSendgridContacts() {
  const response = await fetch('https://api.sendgrid.com/v3/marketing/contacts/search', {
    body: JSON.stringify({ query: `CONTAINS(list_ids, '${process.env.SENDGRID_LIST_ID}')` }),
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_TOKEN}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  const contacts = await response.json();

  return contacts.result;
}

function getFirstName(name) {
  if (name.indexOf(' ')) {
    return name.split(' ')[0];
  }
  return name;
}

function getLastName(name) {
  if (name.indexOf(' ')) {
    return name
      .split(' ')
      .slice(1)
      .join(' ');
  }
  return undefined;
}

async function doSync() {
  const players = await getWarhornPlayers();
  const contacts = await getSendgridContacts();

  const newPlayers = players
    .filter(p => {
      const matching = contacts.filter(c => c.email.toLowerCase() === p.Email.toLowerCase());
      return !matching.length;
    })
    .map(p => ({
      email: p.Email,
      first_name: getFirstName(p.Name),
      last_name: getLastName(p.Name)
    }));

  const requestBody = {
    list_ids: [process.env.SENDGRID_LIST_ID],
    contacts: newPlayers
  };

  console.log(requestBody);

  if (!newPlayers.length) {
    console.log('No new players on Warhorn found.');
    return;
  }

  const response = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
    body: JSON.stringify(requestBody),
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_TOKEN}`,
      'Content-Type': 'application/json'
    },
    method: 'PUT'
  });

  const output = await response.json();

  console.log(output);
}

doSync();
