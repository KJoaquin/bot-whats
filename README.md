## Chatbot Whatsapp (OpenSource)

#### Actualización

| Feature  | Status |
| ------------- | ------------- |
| Dialogflow  | ✅  |
| MySQL  | ✅  |
| JSON File  | ✅  |
| QR Scan (route) | ✅ |
| Easy deploy heroku  | ✅  |
| Buttons | ✅ℹ️  (No funciona en multi-device)|
| Send Voice Note | ✅ |
| Add support ubuntu/linux | ✅ |

## Requisitos
- node v14 o superior
- VSCode (Editor de codigo) [Descargar](https://code.visualstudio.com/download)
- MySql (opcional) solo aplica si vas a usar el modo 'mysql'  [sql-bot.sql migración](https://github.com/leifermendez/bot-whatsapp/blob/main/sql-bot.sql)
- Dialogflow (opcional) solo aplica si vas a usar el modo 'dialogflow'

### (Nuevo) Botones

[![btn](https://i.imgur.com/W7oYlSu.png)](https://youtu.be/5lEMCeWEJ8o) 

> Implementar los botones solo necesitas hacer uso del metodo __sendMessageButton__ que se encuentra dentro `./controllers/send` dejo un ejemplo de como usarlo.
[Ver implementación](https://github.com/leifermendez/bot-whatsapp/blob/main/app.js#L123)

``` javascript
const { sendMessageButton } = require('./controllers/send')

await sendMessageButton(
    {
        "title":"¿Que te interesa ver?",
        "message":"Recuerda todo este contenido es gratis y estaria genial que me siguas!",
        "footer":"Gracias",
        "buttons":[
            {"body":"😎 Cursos"},
            {"body":"👉 Youtube"},
            {"body":"😁 Telegram"}
        ]
    }
)


