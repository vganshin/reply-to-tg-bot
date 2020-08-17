const axios = require('axios');
const fs = require('fs');

process.on('unhandledRejection', (reason, p) => {
  console.log(reason);
  log({type: 'error', data: JSON.stringify(reason)});
  process.exit(1);
});

const TG_BASE_URL = 'https://api.telegram.org/bot';

const TG_TOKEN = process.env.TG_TOKEN;
const CHAT_ID = parseInt(process.env.CHAT_ID);
const CHANNEL_ID= parseInt(process.env.CHANNEL_ID);
const TIMEOUT=1;

function log(data) {
  const ts = (new Date()).toISOString();
  console.log(JSON.stringify({...data, ts}));
  fs.appendFileSync(`logs/${ts.slice(0, 10)}.log`,
                    JSON.stringify({...data, ts}) + '\n');
}

function send(action, data) {
  log({type: 'tg-send', action, data});
  return axios.post(`${TG_BASE_URL}${TG_TOKEN}/${action}`, data);
}

async function processUpdates(offset) {
  const url = `/getUpdates?timeout=${TIMEOUT}&allowed_updates=["message"]${offset ? '&offset=' + offset : ''}`;

  console.log(url);
  const resp = await axios.get(`${TG_BASE_URL}${TG_TOKEN}${url}`);

  resp.data.result.forEach(({message}) => {
    if (message.chat.id !== CHAT_ID) {
      console.log(`Wrong chat id: expected ${CHAT_ID} but ${message.chat.id}`);
      return;
    }

    log({type: 'tg-message', data: message});

    if ((message.text || 'not specified').startsWith('/post')) {
      if (message.reply_to_message && message.reply_to_message.text) {
        send('sendMessage', {chat_id: CHANNEL_ID, text: message.reply_to_message.text});
      }

      if (message.reply_to_message && message.reply_to_message.photo) {
        send('sendPhoto', {chat_id: CHANNEL_ID, photo: message.reply_to_message.photo[message.reply_to_message.photo.length - 1].file_id, caption: message.reply_to_message.caption});
      }

      console.log(JSON.stringify(message,null,1))
      console.log(message.text)
      console.log(message.reply_to_message && message.reply_to_message.text)
    } else {
      console.log(`Unknown command ${message.text}`)
    }
  });

  const newOffset = resp.data.result.reduce((offset, {update_id}) => update_id, null);
  return processUpdates(newOffset ? newOffset + 1 : offset);
}

async function main() {
  const me = await axios.get(`${TG_BASE_URL}${TG_TOKEN}/getMe`);
  console.log('==============================');
  console.log('   Running as @' + me.data.result.username);
  console.log(`     Chat id: ${CHAT_ID}`);
  console.log(`  Channel id: ${CHANNEL_ID}`);
  console.log('==============================');

  processUpdates();
}

main();
