const notifier = require('node-notifier')
const path = require('path')

const notification = (data)=>{
    try {
        let {title,message,icon,sound,wait,actions,reply,topic} = data

        notifier.notify(
            {   
                title: title || '...',
                message: message || '...',
                icon: path.join(__dirname,'assets/imgNotif/', icon == undefined ? 'default.png' : icon+'.png'),
                sound: sound != undefined ? sound : true,
                wait: wait != undefined ? wait : true,
                reply: reply != undefined ? reply : true,
                actions: actions != undefined ? actions :  [],
                appID : topic || 'Notifications'
            },
            function(err) {
                if (err) throw err;
            }
        )
    
    } catch (err) {
         notifier.notify({   
            title: 'Erreur notification',
            message:  'Il y a une erreur sur les notifications :' + data,
            icon: path.join(__dirname,'assets/imgNotif/', 'error.png'),
            wait:  true,
            reply: false,
            appID : 'Notifications'
        })
    }
}

module.exports = notification
