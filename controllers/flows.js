const {get, reply, getIA} = require('../adapter')
const {saveExternalFile, checkIsUrl} = require('./handle')

const getMessages = async (message) => {
    const data = await get(message)
    return data
}

const responseMessages = async (step) => {
    const data = await reply(step)
    if(data && data.media){
        const file = checkIsUrl(data.media) ? await saveExternalFile(data.media) : data.media;
        return {...data,...{media:file}}
    }
    return data
}

const bothResponse = async (message) => {
    const data = await getIA(message)

    if(data && data.media || data.payload){

        if(data.payload.media.structValue){
            //console.log(".....", response.payload.media);
            let mediaRespone = data.payload.media
            
            let mediaR = mediaRespone.structValue.fields.media.stringValue;
    
            //console.log("text ...", mediaRespone.structValue.fields.text.stringValue);
            //console.log("media ...", mediaR);
    
            const file = await saveExternalFile(mediaR)
            //console.log("");
            //console.log("----------", file);
            //console.log("");
            return {...data,...{media:file}}
    
        }

        const file = await saveExternalFile(data.media)
        return {...data,...{media:file}}
    }

    return data
}


module.exports = { getMessages, responseMessages, bothResponse }