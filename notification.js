const notifier = require('node-notifier')
const path = require('path')

const notification = (data)=>{
    try {
        let {title,message,icon,sound,wait,actions,reply,topic} = JSON.parse(data)

        notifier.notify(
            {   
                title: title || '...',
                message: message || '...',
                icon: path.join(__dirname,'assets/imgNotif/', icon == undefined ? 'default.png' : icon+'.png'), // Absolute path (doesn't work on balloons)
                sound: sound != undefined ? sound : true, // Only Notification Center or Windows Toasters
                wait: wait != undefined ? wait : true, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
                reply: reply != undefined ? reply : true,
                actions: actions != undefined ? actions :  [],
                //appID : '\t'
                appID : topic//'Notifications'
            },
            function(err, response,metadata) {
                console.log(err,response,metadata);
                if (err) throw err;
               
            }
        )
    
        notifier.on('click', function(notifierObject, options, event) {
            // Triggers if `wait: true` and user clicks notification
            console.log(notifierObject, options, event)
            ws.send(JSON.stringify({}))
        })
           
          notifier.on('timeout', function(notifierObject, options) {
            // Triggers if `wait: true` and notification closes
        })
    } catch (err) {
         notifier.notify({   
            title: 'Erreur notification',
            message:  'Il y a une erreur sur les notifications :'+data,
            icon: path.join(__dirname,'assets/imgNotif/', 'error.png'), // Absolute path (doesn't work on balloons)
            wait:  true, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
            reply: false,
            appID : 'Notifications'
        })
    }
}

module.exports = notification
