"use strict";
const { default: makeWASocket, DisconnectReason, useSingleFileAuthState, makeInMemoryStore, downloadContentFromMessage, jidDecode, generateForwardMessageContent, generateWAMessageFromContent } = require("@adiwajshing/baileys")
const fs = require("fs");
const chalk = require('chalk')
const logg = require('pino')
const FileType = require('file-type')
const path = require('path')
const { serialize, fetchJson, sleep, getBuffer, reSize } = require("./lib/myfunc");
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { nocache, uncache } = require('./lib/chache.js');

let setting = JSON.parse(fs.readFileSync('./setting.json'));
let session = `./${setting.sessionName}.json`
const { state, saveState } = useSingleFileAuthState(session)

const memory = makeInMemoryStore({ logger: logg().child({ level: 'fatal', stream: 'store' }) })

const connectToWhatsApp = async () => {
const sanzy = makeWASocket({
printQRInTerminal: true,
logger: logg({ level: 'fatal' }),
browser: ['SanzyXD','Safari','1.0.0'],
auth: state
})
memory.bind(sanzy.ev)

sanzy.ev.on('messages.upsert', async m => {
var msg = m.messages[0]
if (!m.messages) return;
if (msg.key && msg.key.remoteJid == "status@broadcast") return
msg = serialize(sanzy, msg)
msg.isBaileys = msg.key.id.startsWith('BAE5') || msg.key.id.startsWith('3EB0')
require('./index')(sanzy, msg, m, setting, memory)
})

sanzy.ev.on('creds.update', () => saveState)

sanzy.reply = (from, content, msg) => sanzy.sendMessage(from, { text: content }, { quoted: msg })

sanzy.ev.on('connection.update', (update) => {
console.log('Connection update:', update)
if (update.connection === 'open') 
console.log("Connected with " + sanzy.user.id)
else if (update.connection === 'close')
connectToWhatsApp()
})


   /**
     * 
     * @param {*} jid 
     * @param {*} path 
     * @param {*} quoted 
     * @param {*} options 
     * @returns 
     */
sanzy.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
let buffer
if (options && (options.packname || options.author)) {
buffer = await writeExifImg(buff, options)
} else {
buffer = await imageToWebp(buff)
}
await sanzy.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
return buffer
}
sanzy.sendImage = async (jid, path, caption = '', quoted = '', options) => {
let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
return await sanzy.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted })
}
/**
* 
* @param {*} jid 
* @param {*} path 
* @param {*} filename
* @param {*} caption
* @param {*} quoted 
* @param {*} options 
* @returns 
*/
sanzy.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
let types = await sanzy.getFile(path, true)
let { mime, ext, res, data, filename } = types
if (res && res.status !== 200 || file.length <= 65536) {
try { return { json: JSON.parse(file.toString()) } }
catch (e) { if (e.json) return e.json }
}
let type = '', mimetype = mime, pathFile = filename
if (options.asDocument) type = 'document'
if (options.asSticker || /webp/.test(mime)) {
let { writeExif } = require('./lib/exif')
let media = { mimetype: mime, data }
pathFile = await writeExif(media, { packname: options.packname ? options.packname : setting.packname, author: options.author ? options.author : setting.author, categories: options.categories ? options.categories : [] })
await fs.promises.unlink(filename)
type = 'sticker'
mimetype = 'image/webp'
}
else if (/image/.test(mime)) type = 'image'
else if (/video/.test(mime)) type = 'video'
else if (/audio/.test(mime)) type = 'audio'
else type = 'document'
await sanzy.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ...options })
return fs.promises.unlink(pathFile)
}
sanzy.decodeJid = (jid) => {
if (!jid) return jid
if (/:\d+@/gi.test(jid)) {
let decode = jidDecode(jid) || {}
return decode.user && decode.server && decode.user + '@' + decode.server || jid
} else return jid
}
/**
* 
* @param {*} path 
* @returns 
*/
sanzy.getFile = async (PATH, save) => {
let res
let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
//if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
let type = await FileType.fromBuffer(data) || {
mime: 'application/octet-stream',
ext: '.bin'
}
filename = path.join(__filename, '../src/' + new Date * 1 + '.' + type.ext)
if (data && save) fs.promises.writeFile(filename, data)
return {
res,
 filename,
size: await getSizeMedia(data),
...type,
data
}
}
return sanzy
}
connectToWhatsApp()
.catch(err => console.log(err))


