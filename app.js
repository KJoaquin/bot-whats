/**
 * ⚡⚡⚡ DECLARAMOS LAS LIBRERIAS y CONSTANTES A USAR! ⚡⚡⚡
 */
require('dotenv').config()

const fs = require('fs');
const cors = require('cors')
const express = require('express');
const request = require('request');
const qrcode = require('qrcode-terminal');
const mysqlConnection = require('./config/mysql');
const { saveMedia } = require('./controllers/save');
const { connectionReady, connectionLost } = require('./controllers/connection');
const { Location, List, Buttons, Client, LocalAuth } = require('whatsapp-web.js');
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows');
const { sendMedia, sendMessage, lastTrigger, sendMessageButton, readChat } = require('./controllers/send');
const { generateImage, cleanNumber, checkEnvFile, createClient, isValidNumber } = require('./controllers/handle');

const app = express();
const port = process.env.PORT || 3000
const server = require('http').Server(app)

var client;

app.use('/', require('./routes/web'))
app.use(cors())
app.use(express.json())

client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.initialize();

// Configuraciones

client.on('qr', qr => generateImage(qr, () => {
    qrcode.generate(qr, { small: true });

    console.log(`Ver QR http://localhost:${port}/qr`)
    socketEvents.sendQR(qr)
}))

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', (e) => {
    // console.log(e)
    // connectionLost()
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', (a) => {
    connectionReady()
    listenMessage()
    // socketEvents.sendStatus(client)
});

// Escuchamos cuando entre un mensaje

const listenMessage = () => client.on('message', async msg => {
    const { from, body, _data, hasMedia } = msg;

    //console.log('MESSAGE RECEIVED', msg);
    console.log(_data.notifyName);

    if (!isValidNumber(from)) {
        return
    }

    // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados
    if (from === 'status@broadcast') {
        return
    }

    message = body.toLowerCase();
    const number = cleanNumber(from)
    await readChat(number, message)
    //console.log('BODY', message)

    // Guardamos el archivo multimedia que envia
    if (process.env.SAVE_MEDIA && hasMedia) {
        const media = await msg.downloadMedia();
        saveMedia(media);
    }

    // Ejemplos de envios al usuario
    if (process.env.EJEMPLOS_SEND) {

        if (msg.body === '!ping reply') {
            // Enviar un nuevo mensaje como respuesta al actual
            msg.reply('pong');
    
        } else if (msg.body === '!ping') {
            // Enviar un nuevo mensaje al mismo chat
            client.sendMessage(msg.from, 'pong');
    
        } else if (msg.body.startsWith('!sendto')) {
            // Envío directo de un nuevo mensaje a una identificación específica
            let number = msg.body.split(' ')[1];
            console.log(number);
            let messageIndex = msg.body.indexOf(number) + number.length;
            let message = msg.body.slice(messageIndex, msg.body.length);
            number = number.includes('@c.us') ? number : `${number}@c.us`;
            let chat = await msg.getChat();
            chat.sendSeen();
            client.sendMessage(number, message);
    
        } else if (msg.body.startsWith('!subject ')) {
            // Cambiar el tema del grupo
            let chat = await msg.getChat();
            if (chat.isGroup) {
                let newSubject = msg.body.slice(9);
                chat.setSubject(newSubject);
            } else {
                msg.reply('¡Este comando solo se puede usar en un grupo!');
            }
        } else if (msg.body.startsWith('!echo ')) {
            // Responde con el mismo mensaje
            msg.reply(msg.body.slice(6));
        } else if (msg.body.startsWith('!desc ')) {
            // Cambiar la descripción del grupo
            let chat = await msg.getChat();
            if (chat.isGroup) {
                let newDescription = msg.body.slice(6);
                chat.setDescription(newDescription);
            } else {
                msg.reply('¡Este comando solo se puede usar en un grupo!');
            }
        } else if (msg.body === '!leave') {
            // Leave the group
            let chat = await msg.getChat();
            if (chat.isGroup) {
                chat.leave();
            } else {
                msg.reply('¡Este comando solo se puede usar en un grupo!');
            }
        } else if (msg.body.startsWith('!join ')) {
            const inviteCode = msg.body.split(' ')[1];
            try {
                await client.acceptInvite(inviteCode);
                msg.reply('¡Únete al grupo!');
            } catch (e) {
                msg.reply('Ese código de invitación parece no ser válido.');
            }
        } else if (msg.body === '!groupinfo') {
            let chat = await msg.getChat();
            if (chat.isGroup) {
                msg.reply(`
                    *Detalles del grupo*
                    Nombre: ${chat.name}
                    Descripcion: ${chat.description}
                    Creado en: ${chat.createdAt.toString()}
                    Creado por: ${chat.owner.user}
                    Recuento de participantes: ${chat.participants.length}
                `);
            } else {
                msg.reply('¡Este comando solo se puede usar en un grupo!');
            }
        } else if (msg.body === '!chats') {
            const chats = await client.getChats();
            client.sendMessage(msg.from, `El bot tiene ${chats.length} chats abiertos.`);
        } else if (msg.body === '!info') {
    
            let info = client.info;
            client.sendMessage(msg.from, `*Información de conexión:*
            Nombre de usuario: ${info.pushname}
            Mi número: ${info.wid.user}
            Plataforma: ${info.plataforma}`);
    
        } else if (msg.body === '!mediainfo' && msg.hasMedia) {
            const attachmentData = await msg.downloadMedia();
            msg.reply(`*Información de los medios*
                MimeType: ${attachmentData.mimetype}
                Nombre de archivo: ${attachmentData.filename}
                Datos (longitud): ${attachmentData.data.length}
            `);
        } else if (msg.body === '!quoteinfo' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
    
            quotedMsg.reply(`Id: ${quotedMsg.id._serialized} \n`+
            `Escriba: ${quotedMsg.type} \n`+
            `Autor: ${quotedMsg.author || quotedMsg.from} \n`+
            `Marca de tiempo: ${quotedMsg.timestamp} \n`+
            `¿Tiene medios? ${quotedMsg.hasMedia}`);
    
        } else if (msg.body === '!resendmedia' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                const attachmentData = await quotedMsg.downloadMedia();
                client.sendMessage(msg.from, attachmentData, { caption: 'Aquí están los medios solicitados.' });
            }
        } else if (msg.body === '!location') {
            console.log("Enviando Ubiacaion.....");
            msg.reply(new Location(37.422, -122.084, 'Googleplex\nGoogle Headquarters'));
        } else if (msg.location) {
    
            console.log("Ubiacaion Recibida.....", msg.location);
            msg.reply(msg.location);
    
        } else if (msg.body.startsWith('!status ')) {
            const newStatus = msg.body.split(' ')[1];
            await client.setStatus(newStatus);
            msg.reply(`El estado se actualizó a *${newStatus}*`);
        } else if (msg.body === '!mention') {
            const contact = await msg.getContact();
            const chat = await msg.getChat();
            chat.sendMessage(`Hola @${contact.number}!`, {
                mentions: [contact]
            });
        } else if (msg.body === '!delete') {
            if (msg.hasQuotedMsg) {
                const quotedMsg = await msg.getQuotedMessage();
                if (quotedMsg.fromMe) {
                    quotedMsg.delete(true);
                } else {
                    msg.reply('Solo puedo borrar mis propios mensajes.');
                }
            }
        } else if (msg.body === '!pin') {
    
            console.log("Anclar chat");
            const chat = await msg.getChat();
            await chat.pin();
    
        } else if (msg.body === '!archive') {
    
            console.log("Archivando chat.....");
            const chat = await msg.getChat();
            await chat.archive();
    
        } else if (msg.body === '!mute') {
    
            console.log("Silenciando conversacion");
            const chat = await msg.getChat();
            // silenciar el chat durante 20 segundos
            const unmuteDate = new Date();
            unmuteDate.setSeconds(unmuteDate.getSeconds() + 20);
            await chat.mute(unmuteDate);
    
        } else if (msg.body === '!typing') {
    
            const chat = await msg.getChat();
            // simula escribir en el chat
            chat.sendStateTyping();
    
        } else if (msg.body === '!recording') {
    
            const chat = await msg.getChat();
            // simula grabar audio en el chat
            chat.sendStateRecording();
    
        } else if (msg.body === '!clearstate') {
    
            const chat = await msg.getChat();
            // deja de escribir o grabar en el chat
            chat.clearState();
    
        } else if (msg.body === '!jumpto') {
    
            if (msg.hasQuotedMsg) {
                const quotedMsg = await msg.getQuotedMessage();
                client.interface.openChatWindowAt(quotedMsg.id._serialized);
            }
    
        } else if (msg.body === '!buttons') {
            
            console.log('***** entro *******');
    
            let button = new Buttons('Button body',[{body:'bt1'},{body:'bt2'},{body:'bt3'}],'title','footer','button');
    
            let button_v2 = {
    
                "body": 'Button body',
                "title": 'title',
                "footer": 'footer',
                "type": 'quick_reply',
                "buttons": [
                    {
                        "buttonId": "1",
                        "type": 1,
                        "buttonText" :{
                            "id": 1,
                            "body": "H1"
                        }               
                    }
    
                ]
                
            };
    
            console.log("------------------");
            console.log(button_v2.custom);
            console.log(button);
            console.log("------------------");
    
            sendMessageButton(client, from, null,button);
    
        } else if (msg.body === '!list') {
    
            let sections = [{ title: 'sectionTitle', rows: [{ title: 'ListItem1', description: 'desc' }, { title: 'ListItem2' }] }];
            let list = new List('List body', 'btnText', sections, 'Title', 'footer');
            client.sendMessage(msg.from, list);
    
        } else if (msg.body === '!reaction') {
            msg.react('👍');
        }

    }

    //Si estas usando dialogflow solo manejamos una funcion todo es IA
    if (process.env.DATABASE === 'dialogflow') {

        console.log("°°°°°° DialogFlow °°°°°°");
        if (!message.length) return;

        const response = await bothResponse(message);
        
        let sendMss    = response.replyMessage;
        let action     = response.actionName;
        let parameters = response.parameters;

        let tel = number.replace('@c.us', "");

        console.log("Respuesta de DialogFlow ", parameters);

        console.log(".");
		console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
		console.log('|TOYOTA---Faq--------------------->', action);
		console.log('|TOYOTA---msgUser----------------->', message);
		console.log('|TOYOTA---User-------------------->', _data.notifyName);
		console.log('|TOYOTA---ID---------------------->', tel);
		console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
        console.log(".");

        switch (action) {//- Menus de Entrada Principal ----------------

            case "#Menu_Inicio":

                const contact = await msg.getContact();
                const chat = await msg.getChat();

                sendMss = sendMss.replace('[userName]', `@${contact.number}` );

                chat.sendMessage(sendMss, {
                    mentions: [contact]
                });

                setTimeout(() => {

                    if (response.media) {

                        let captionMedia;
                        if(response.payload.media.structValue){
                            let mediaRespone = response.payload.media
                            
                            captionMedia = mediaRespone.structValue.fields.text.stringValue;

                            //console.log("text ...", captionMedia);

                        }

                        sendMedia(client, from, response.media, captionMedia);
                    }

                }, 1000);

            break;
            
        //------------- Cotizaciones/Consultas -------------------------

            case "Pre_avaluo":

                let name  = (isDefined(parameters['name'].stringValue)  && parameters['name'].stringValue  != '')  ? parameters['name'].stringValue : '';
                let email = (isDefined(parameters['email'].stringValue) && parameters['email'].stringValue != '') ? parameters['email'].stringValue : '';
                let placa = (isDefined(parameters['placa'].stringValue) && parameters['placa'].stringValue != '') ? parameters['placa'].stringValue : '';
                let kilo  = (isDefined(parameters['kilo'].numberValue)  && parameters['kilo'].numberValue  != '')  ? parameters['kilo'].numberValue : '';
  
                /**/   if (name == '' && email == '' && placa == '' && kilo == '') {
                    console.log('Pidiendo Nombre');

                    await sendMessage(client, from, sendMss);

                } else if (name != '' && email == '' && placa == '' && kilo == '') {
                    console.log('Pidiendo Correo');
                    console.log('Información de nombre: ', name);

                    await sendMessage(client, from, sendMss);
                    
                } else if (name != '' && email != '' && placa == '' && kilo == '') {
                    console.log('Pidiendo Placa');
                    console.log('Información de nombre: ', name);
                    console.log('Información de correo: ', email);

                    await sendMessage(client, from, sendMss);
                    
                } else if (name != '' && email != '' && placa != '' && kilo == '') {
                    console.log('Pidiendo Kilometro');
                    console.log('Información de nombre: ', name);
                    console.log('Información de correo: ', email);
                    console.log('Información de placa : ', placa.toUpperCase());

                    await sendMessage(client, from, sendMss);
                    
                } else if (name != '' && email != '' && placa != '' && kilo != '') {
                    console.log('Mostrando todos los datos');
                    console.log('Información de nombre: ', name);
                    console.log('Información de correo: ', email);
                    console.log('Información de placa : ', placa.toUpperCase());
                    console.log('Información de kilo  : ', kilo);

                    request.get("https://cofal.com.gt/VUS.WS.AVALUOONLINE.BE/api/GeneraToken?usuario=AVALUONLIN", function (error, response, body) {
                        //var data = JSON.parse(body); 
                        //console.log("Response Token: ", body);

                        request.post("https://cofal.com.gt/VUS.WS.AVALUOONLINE.BE/api/Avaluo", {
                            json: {
                                nombre: name,
                                apellido: " ",
                                correoElectronico: email,
                                telefono: tel.substring(3),
                                observacion: "Cotizacion de Avaluo",
                                placas: placa.toUpperCase(),
                                kilometraje: `${kilo}`,
                                usuario: "AVALUONLIN",
                                token: body
                            }
                        }, function(error, response, body) {
                            if (!error && response.statusCode == 200) {

                                let precioI = body.rangoDePrecioInicial;
                                let precioF = body.rangoDePrecioFinal;

                                if (precioI== 0 && precioF == 0) {
                                    let text = "No pudimos encontrar información de tu vehículo en nuestro historial de ventas, un agente estará atendiendo tu solicitud.";

                                    sendMessage(client, from, text);

                                    return;
                                }

                                let marcaR = body.marca;
                                let lineaR = body.linea;
                                let modelo = body.modeloVehiculo;

                                let text = `Según los datos proporcionados por usted, el valor aproximado de recepción para ` +
                                `su *${marcaR} ${lineaR}*, Modelo *${modelo}* usado <pre-avalúo>, se encuentra ` +
                                `en un rango estimado de: *Q${precioI}* a *Q${precioF}*.\n\nEste pre-avalúo queda sujeto a una revisión física del ` +
                                `vehículo en donde se confirmará el funcionamiento, kilometraje y condiciones físicas del mismo, dependiendo de estos ` +
                                `factores, se otorgará el valor final de la recepción del vehículo.`;

                                sendMessage(client, from, text);
                                setTimeout(() => {
                                    sendMessage(client, from, sendMss);
                                }, 500);

                            } else {
                                if (response.statusCode != 404) {
                                    console.log("Correo no enviado", response.statusCode);
                                    console.log("body: --- ", body);
                                    console.log("error: --- ", error);
                                }
                            }
                        });

                    });
                    
                }

            break;
    
        //------------- Default ----------------------------------------

            default:
                // Acción no controlada, simplemente devuelva el texto
                if (sendMss == '') return;

                await sendMessage(client, from, sendMss);

        }

        return
    }

});

//Otros.......

client.on('message_create', (msg) => {
    // Despedido en todas las creaciones de mensajes, incluida la suya
    //console.log("Creacion de Mensaje");
    if (msg.fromMe) {
        // hacer cosas aquí
        //console.log(".");
        //console.log("form ME");
        //console.log(".");

    }
});

client.on('message_revoke_everyone', async (after, before) => {
    // Se activa cada vez que alguien elimina un mensaje (incluyéndote a ti)
    console.log(".");
    console.log("Mensaje despues de borrar");
    console.log(after); // mensaje después de haber sido borrado.
    console.log(".");

    if (before) {
        console.log(".");
        console.log("Mensaje antes de borrar");
        console.log(before); // mensaje antes de que fuera eliminado.
        console.log(".");
    }
});

client.on('message_revoke_me', async (msg) => {
    // Se activa cuando un mensaje solo se elimina en su propia vista.
    console.log(".");
    console.log("mensaje antes de que fuera eliminado.");
    console.log(msg.body); // mensaje antes de que fuera eliminado.
    console.log(".");
});

client.on('message_ack', (msg, ack) => {
    /*== VALORES DE RECONOCIMIENTO ==
         ACK_ERROR: -1
         ACK_PENDIENTE: 0
         SERVIDOR_ACK: 1
         ACK_DISPOSITIVO: 2
         ACK_LEER: 3
         ACK_REPRODUCIDO: 4 */

    //console.log(ack);

    if (ack == 3) {
        // El mensaje fue leído
    }
});

client.on('group_join', (notification) => {
    // El usuario se ha unido o ha sido agregado al grupo.
    console.log(".");
    console.log('Se unio ', notification);
    console.log(".");
    notification.reply('Usuario unido.');
});

client.on('group_leave', (notification) => {
    // El usuario se ha ido o ha sido expulsado del grupo.
    console.log(".");
    console.log('Abandono ', notification);
    console.log(".");
    notification.reply('El usuario se fue.');
});

client.on('group_update', (notification) => {
    // Se ha actualizado la imagen de grupo, el tema o la descripción.
    console.log(".");
    console.log('Actualizado ', notification);
    console.log(".");
});

client.on('change_state', state => {
    console.log(".");
    console.log('CAMBIO DE ESTADO', state);
    console.log(".");
});

client.on('disconnected', (reason) => {
    console.log(".");
    console.log('El cliente fue desconectado', reason);
    console.log(".");
});


// Verificamos si tienes un gesto de db


if (process.env.DATABASE === 'mysql') {
    mysqlConnection.connect()
}

server.listen(port, () => {
    console.log(`El server esta listo por el puerto ${port}`);
})

checkEnvFile();

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}